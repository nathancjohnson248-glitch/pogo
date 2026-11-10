import { NextRequest, NextResponse } from "next/server";
import { createHmac, timingSafeEqual } from "node:crypto";
import { createActivity, db, findOrCreatePogoUser, logMessage } from "@/lib/server/db";
import { approveLatestAction, runPogoAgent } from "@/lib/server/agent";
import { getPhotonAgentUserId, sendPhotonText } from "@/lib/server/photon";

export const runtime = "nodejs";
export const maxDuration = 60;

type PhotonContent = {
  type?: string;
  text?: string;
  reaction?: string;
  attachmentId?: string;
  metadata?: Record<string, unknown>;
  parts?: PhotonContent[];
  question?: string;
  options?: Array<{ id?: string; text?: string; title?: string }>;
  selectedOptions?: Array<{ id?: string; text?: string; title?: string }>;
};

type PhotonUser = { id?: string; handle?: string; platform?: string };
type PhotonSpace = { id?: string; platform?: string };
type PhotonMessage = {
  id?: string;
  projectId?: string;
  platform?: string;
  status?: string;
  sentBy?: PhotonUser;
  receivedBy?: PhotonUser;
  addressedTo?: PhotonUser;
  space?: PhotonSpace;
  content?: PhotonContent;
  parentMessageId?: string;
  createdAt?: string;
};

type PhotonEvent = {
  id?: string;
  type?: string;
  apiVersion?: string;
  source?: string;
  timestamp?: string;
  data?: { projectId?: string; object?: PhotonMessage };
};

function safeEqual(a: string, b: string) {
  const left = Buffer.from(a);
  const right = Buffer.from(b);
  return left.length === right.length && timingSafeEqual(left, right);
}

function verifyPhotonSignature(rawBody: string, secret: string, signature: string, timestamp: string) {
  if (!signature) return false;
  if (timestamp && /^\d+$/.test(timestamp)) {
    const sentAt = Number(timestamp);
    if (!Number.isFinite(sentAt) || Math.abs(Date.now() / 1000 - sentAt) > 300) return false;
    const timestamped = `v0=${createHmac("sha256", secret).update(`v0:${timestamp}:${rawBody}`).digest("hex")}`;
    if (safeEqual(signature, timestamped)) return true;
  }
  // Also accept Photon destinations that sign the raw body directly.
  const rawDigest = createHmac("sha256", secret).update(rawBody).digest("hex");
  return safeEqual(signature, rawDigest) || safeEqual(signature, `sha256=${rawDigest}`);
}

function contentText(content?: PhotonContent): string {
  if (!content) return "";
  if (content.type === "text") return content.text ?? "";
  if (content.type === "group") return (content.parts ?? []).map(contentText).filter(Boolean).join("\n");
  if (content.type === "reaction") return content.reaction ? `[reaction: ${content.reaction}]` : "[reaction received]";
  if (content.type === "voice") return "[voice message received]";
  if (content.type === "attachment") return "[attachment received]";
  if (content.type === "poll") return `[poll: ${content.question ?? "question"}]`;
  if (content.type === "poll.vote") return "[poll vote received]";
  if (content.type === "message.update") return content.text ?? "[message update received]";
  if (content.type) return `[${content.type} received]`;
  return "";
}

export async function POST(request: NextRequest) {
  const secret = process.env.PHOTON_WEBHOOK_SECRET;
  if (!secret) return NextResponse.json({ error: "Photon webhook is not configured." }, { status: 503 });

  const rawBody = await request.text();
  const signature = request.headers.get("x-photon-signature")
    ?? request.headers.get("x-spectrum-signature")
    ?? "";
  const timestamp = request.headers.get("x-photon-timestamp")
    ?? request.headers.get("x-spectrum-timestamp")
    ?? "";
  if (!verifyPhotonSignature(rawBody, secret, signature, timestamp)) {
    return NextResponse.json({ error: "Invalid Photon signature." }, { status: 401 });
  }

  let event: PhotonEvent;
  try {
    event = JSON.parse(rawBody) as PhotonEvent;
  } catch {
    return NextResponse.json({ error: "Invalid JSON." }, { status: 400 });
  }

  if (event.type !== "message.received") {
    return NextResponse.json({ received: true, ignored: true });
  }

  const message = event.data?.object;
  const spaceId = message?.space?.id;
  const senderId = message?.sentBy?.id;
  const messageId = message?.id;
  if (!messageId || !spaceId || !senderId || !event.id) {
    return NextResponse.json({ error: "Photon message event is missing its event, sender, space, or message ID." }, { status: 400 });
  }

  const body = contentText(message.content).trim();
  if (!body) return NextResponse.json({ received: true, ignored: true });

  try {
    const eventRows = await db<Array<{ id: string }>>("pogo_webhook_events", {
      method: "POST",
      body: {
        provider: "photon",
        provider_event_id: event.id,
        event_type: event.type,
        payload: event
      },
      prefer: "return=representation,resolution=ignore-duplicates"
    });
    if (!eventRows?.length) return NextResponse.json({ received: true, duplicate: true });

    const platform = message.platform ?? message.space?.platform ?? "imessage";
    const user = await findOrCreatePogoUser(message.sentBy?.handle ?? senderId, senderId, platform, spaceId);
    const agentUserId = getPhotonAgentUserId();
    await logMessage({
      userId: user.id,
      providerMessageId: messageId,
      spaceId,
      direction: "inbound",
      platform,
      body,
      metadata: {
        photon_event_id: event.id,
        content_type: message.content?.type ?? "unknown",
        attachment_id: message.content?.attachmentId ?? null
      }
    });

    if (/^cancel$/i.test(body)) {
      const pending = await db<Array<{ id: string }>>("pogo_approvals", {
        query: `user_id=eq.${user.id}&status=eq.pending&select=id&order=created_at.desc&limit=1`
      });
      if (pending[0]) {
        await db("pogo_approvals", {
          method: "PATCH",
          query: `id=eq.${pending[0].id}`,
          body: { status: "rejected", decided_at: new Date().toISOString() }
        });
      }
      await sendPhotonText(spaceId, agentUserId, "got it. i cancelled that pending action.", messageId);
      return NextResponse.json({ received: true });
    }

    if (/^approve$/i.test(body)) {
      const result = await approveLatestAction(user.id);
      await sendPhotonText(spaceId, agentUserId, result, messageId);
      return NextResponse.json({ received: true, approval: "processed" });
    }

    const reply = await runPogoAgent({
      userId: user.id,
      message: body,
      phone: message.sentBy?.handle ?? senderId
    });
    const sent = await sendPhotonText(spaceId, agentUserId, reply, messageId);
    await logMessage({
      userId: user.id,
      providerMessageId: `pogo-${messageId}`,
      spaceId,
      direction: "outbound",
      platform,
      body: reply,
      status: "sent",
      metadata: { photon: sent, content_type: message.content?.type ?? "unknown" }
    });
    await createActivity(user.id, "message_handled", "Pogo replied", reply.slice(0, 500));
    return NextResponse.json({ received: true });
  } catch (error) {
    console.error("Photon webhook processing failed", error);
    return NextResponse.json({ error: "Message processing failed." }, { status: 500 });
  }
}
