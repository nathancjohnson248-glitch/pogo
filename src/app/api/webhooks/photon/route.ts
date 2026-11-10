import { NextRequest, NextResponse } from "next/server";
import { createHmac, timingSafeEqual } from "node:crypto";
import { createActivity, db, findOrCreatePogoUser, logMessage } from "@/lib/server/db";
import { approveLatestAction, runPogoAgent } from "@/lib/server/agent";
import { getPhotonAgentUserId, sendPhotonText } from "@/lib/server/photon";

export const runtime = "nodejs";
export const maxDuration = 60;

type SpectrumMessage = {
  id?: string;
  platform?: string;
  direction?: "inbound" | "outbound";
  sender?: { id?: string; platform?: string };
  content?: { type?: string; text?: string; items?: Array<{ type?: string; text?: string }> };
  space?: { id?: string; platform?: string };
};

type SpectrumEvent = {
  event?: string;
  space?: { id?: string; platform?: string };
  message?: SpectrumMessage;
};

function verifySpectrumSignature(rawBody: string, secret: string, signature: string, timestamp: string) {
  if (!signature || !timestamp || !/^\d+$/.test(timestamp)) return false;
  const sentAt = Number(timestamp);
  if (!Number.isFinite(sentAt) || Math.abs(Date.now() / 1000 - sentAt) > 300) return false;
  const expected = `v0=${createHmac("sha256", secret).update(`v0:${timestamp}:${rawBody}`).digest("hex")}`;
  const a = Buffer.from(signature);
  const b = Buffer.from(expected);
  return a.length === b.length && timingSafeEqual(a, b);
}

function messageText(message: SpectrumMessage) {
  if (message.content?.type === "text" && message.content.text) return message.content.text;
  return message.content?.items?.filter((item) => item.type === "text").map((item) => item.text ?? "").join("\n") ?? "";
}

export async function POST(request: NextRequest) {
  const secret = process.env.PHOTON_WEBHOOK_SECRET;
  if (!secret) return NextResponse.json({ error: "Photon webhook is not configured." }, { status: 503 });

  const rawBody = await request.text();
  const signature = request.headers.get("x-spectrum-signature") ?? "";
  const timestamp = request.headers.get("x-spectrum-timestamp") ?? "";
  if (!verifySpectrumSignature(rawBody, secret, signature, timestamp)) {
    return NextResponse.json({ error: "Invalid Photon signature." }, { status: 401 });
  }

  let event: SpectrumEvent;
  try { event = JSON.parse(rawBody) as SpectrumEvent; } catch {
    return NextResponse.json({ error: "Invalid JSON." }, { status: 400 });
  }

  if (event.event !== "messages") return NextResponse.json({ received: true, ignored: true });
  const message = event.message;
  const spaceId = event.space?.id ?? message?.space?.id;
  const senderId = message?.sender?.id;
  if (!message?.id || !spaceId || !senderId) {
    return NextResponse.json({ error: "Message event is missing sender, space, or message ID." }, { status: 400 });
  }
  if (message.direction !== "inbound") return NextResponse.json({ received: true, ignored: true });

  const body = messageText(message).trim();
  if (!body) return NextResponse.json({ received: true, ignored: true });

  try {
    const eventRows = await db<Array<{ id: string }>>("pogo_webhook_events", {
      method: "POST",
      body: {
        provider: "photon",
        provider_event_id: message.id,
        event_type: event.event,
        payload: event
      },
      prefer: "return=representation,resolution=ignore-duplicates"
    });
    if (!eventRows?.length) return NextResponse.json({ received: true, duplicate: true });

    const platform = message.platform ?? event.space?.platform ?? "imessage";
    const user = await findOrCreatePogoUser(senderId, senderId, platform, spaceId);
    const agentUserId = getPhotonAgentUserId();
    await logMessage({
      userId: user.id,
      providerMessageId: message.id,
      spaceId,
      direction: "inbound",
      platform,
      body
    });

    if (/^cancel$/i.test(body)) {
      const pending = await db<Array<{ id: string }>>("pogo_approvals", {
        query: `user_id=eq.${user.id}&status=eq.pending&select=id&order=created_at.desc&limit=1`
      });
      if (pending[0]) await db("pogo_approvals", {
        method: "PATCH",
        query: `id=eq.${pending[0].id}`,
        body: { status: "rejected", decided_at: new Date().toISOString() }
      });
      await sendPhotonText(spaceId, agentUserId, "Got it. I cancelled that pending action.", message.id);
      return NextResponse.json({ received: true });
    }

    if (/^approve$/i.test(body)) {
      const result = await approveLatestAction(user.id);
      await sendPhotonText(spaceId, agentUserId, result, message.id);
      return NextResponse.json({ received: true, approval: "processed" });
    }

    const reply = await runPogoAgent({ userId: user.id, message: body, phone: senderId });
    const sent = await sendPhotonText(spaceId, agentUserId, reply, message.id);
    await logMessage({
      userId: user.id,
      providerMessageId: `pogo-${message.id}`,
      spaceId,
      direction: "outbound",
      platform,
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
