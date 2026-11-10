import { NextRequest, NextResponse } from "next/server";
import { Webhook } from "standardwebhooks";
import { createActivity, db, findOrCreatePogoUser, logMessage } from "@/lib/server/db";
import { approveLatestAction, runPogoAgent } from "@/lib/server/agent";
import { getPhotonAgentUserId, sendPhotonText } from "@/lib/server/photon";

export const runtime = "nodejs";
export const maxDuration = 60;

type PhotonMessage = {
  id?: string;
  platform?: string;
  status?: string;
  content?: { type?: string; text?: string; parts?: Array<{type?:string;text?:string}> };
  space?: { id?: string };
  sentBy?: { id?: string; handle?: string };
};

function messageText(message: PhotonMessage) {
  if (message.content?.text) return message.content.text;
  return message.content?.parts?.filter((part) => part.type === "text").map((part) => part.text ?? "").join("\n") ?? "";
}

export async function POST(request: NextRequest) {
  const secret = process.env.PHOTON_WEBHOOK_SECRET;
  if (!secret) return NextResponse.json({ error: "Photon webhook is not configured." }, { status: 503 });

  const rawBody = await request.text();
  const headers = Object.fromEntries(request.headers.entries());
  try {
    new Webhook(secret).verify(rawBody, headers);
  } catch {
    return NextResponse.json({ error: "Invalid Photon signature." }, { status: 401 });
  }

  let event: { id?: string; type?: string; data?: { object?: PhotonMessage } };
  try { event = JSON.parse(rawBody); } catch {
    return NextResponse.json({ error: "Invalid JSON." }, { status: 400 });
  }

  if (event.type !== "message.received") return NextResponse.json({ received: true, ignored: true });
  const message = event.data?.object;
  if (!message?.id || !message.sentBy?.handle || !message.space?.id) {
    return NextResponse.json({ error: "Message event is missing sender, space, or message ID." }, { status: 400 });
  }
  if (message.status && message.status !== "received") return NextResponse.json({ received: true, ignored: true });

  const body = messageText(message).trim();
  if (!body) return NextResponse.json({ received: true, ignored: true });

  try {
    const eventRows = await db<Array<{id:string}>>("pogo_webhook_events", {
      method: "POST",
      body: {
        provider: "photon",
        provider_event_id: event.id ?? message.id,
        event_type: event.type,
        payload: event
      },
      prefer: "return=minimal,resolution=ignore-duplicates"
    });

    const user = await findOrCreatePogoUser(
      message.sentBy.handle,
      message.sentBy.id ?? message.sentBy.handle,
      message.platform ?? "imessage",
      message.space.id
    );
    await logMessage({
      userId: user.id,
      providerMessageId: message.id,
      spaceId: message.space.id,
      direction: "inbound",
      platform: message.platform ?? "imessage",
      body
    });

    if (/^cancel$/i.test(body)) {
      const pending = await db<Array<{id:string}>>("pogo_approvals", {
        query: `user_id=eq.${user.id}&status=eq.pending&select=id&order=created_at.desc&limit=1`
      });
      if (pending[0]) await db("pogo_approvals", {
        method: "PATCH", query: `id=eq.${pending[0].id}`, body: { status: "rejected", decided_at: new Date().toISOString() }
      });
      await sendPhotonText(message.space.id, getPhotonAgentUserId(), "Got it. I cancelled that pending action.");
      return NextResponse.json({ received: true });
    }

    if (/^approve$/i.test(body)) {
      const result = await approveLatestAction(user.id);
      await sendPhotonText(message.space.id, getPhotonAgentUserId(), result);
      return NextResponse.json({ received: true, approval: "processed" });
    }

    const reply = await runPogoAgent({ userId: user.id, message: body, phone: message.sentBy.handle });
    const sent = await sendPhotonText(message.space.id, getPhotonAgentUserId(), reply);
    await logMessage({
      userId: user.id,
      providerMessageId: `pogo-${message.id}`,
      spaceId: message.space.id,
      direction: "outbound",
      platform: message.platform ?? "imessage",
      body: reply,
      status: "sent",
      metadata: { photon: sent }
    });
    await createActivity(user.id, "message_handled", "Pogo replied", reply.slice(0, 500));
    return NextResponse.json({ received: true });
  } catch (error) {
    console.error("Photon webhook processing failed", error);
    return NextResponse.json({ error: "Message processing failed." }, { status: 500 });
  }
}
