import { NextRequest, NextResponse } from "next/server";
import { createActivity, db, findMessageByProviderId, findOrCreatePogoUser, logMessage } from "@/lib/server/db";
import { approveLatestAction, runPogoAgent } from "@/lib/server/agent";
import { getPhotonAgentUserId, sendPhotonText } from "@/lib/server/photon";
import { contentText, verifyPhotonSignature, type PhotonContent } from "@/lib/server/photon-webhook";

export const runtime = "nodejs";
export const maxDuration = 60;

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

export async function POST(request: NextRequest) {
  const secret = process.env.PHOTON_WEBHOOK_SECRET;
  if (!secret) return NextResponse.json({ error: "Photon webhook is not configured." }, { status: 503 });

  const rawBody = await request.text();
  const signature = request.headers.get("webhook-signature") ?? "";
  const webhookId = request.headers.get("webhook-id") ?? "";
  const timestamp = request.headers.get("webhook-timestamp") ?? "";
  if (!verifyPhotonSignature(rawBody, secret, signature, webhookId, timestamp)) {
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

  const eventKey = `provider=eq.photon&provider_event_id=eq.${encodeURIComponent(event.id)}`;
  const replyMessageId = `pogo-reply-${messageId}`;

  // Step 1: persist the event exactly once. A replayed delivery is a no-op.
  const eventRows = await db<Array<{ id: string }>>("pogo_webhook_events", {
    method: "POST",
    query: "on_conflict=provider,provider_event_id&select=id",
    body: { provider: "photon", provider_event_id: event.id, event_type: event.type, payload: event },
    prefer: "resolution=ignore-duplicates,return=representation"
  });
  if (!eventRows?.length) {
    const existing = await db<Array<{ id: string; processed_at: string | null }>>("pogo_webhook_events", {
      query: `${eventKey}&select=id,processed_at&limit=1`
    });
    if (!existing[0]) return NextResponse.json({ error: "Photon event could not be persisted." }, { status: 500 });
    if (existing[0].processed_at) return NextResponse.json({ received: true, duplicate: true });
  }

  // Step 2: claim the event. The conditional update is atomic, so concurrent
  // deliveries of the same event cannot both win; a lease left behind by a
  // crashed attempt expires and becomes claimable again.
  const leaseCutoff = new Date(Date.now() - 5 * 60 * 1000).toISOString();
  const claimed = await db<Array<{ id: string; attempts: number }>>("pogo_webhook_events", {
    method: "PATCH",
    query: `${eventKey}&processed_at=is.null&or=(processing_started_at.is.null,processing_started_at.lt.${encodeURIComponent(leaseCutoff)})&select=id,attempts`,
    body: { processing_started_at: new Date().toISOString() },
    prefer: "return=representation"
  });
  if (!claimed?.length) {
    // Processed in the meantime, or another worker holds the lease. Non-2xx
    // makes Photon retry later, by which time it is either processed
    // (answered as duplicate above) or the stale lease is reclaimable.
    const current = await db<Array<{ processed_at: string | null }>>("pogo_webhook_events", { query: `${eventKey}&select=processed_at&limit=1` });
    if (current[0]?.processed_at) return NextResponse.json({ received: true, duplicate: true });
    return NextResponse.json({ received: true, status: "processing_in_progress" }, { status: 409 });
  }

  const markProcessed = () =>
    db("pogo_webhook_events", { method: "PATCH", query: eventKey, body: { processed_at: new Date().toISOString() }, prefer: "return=minimal" });

  try {
    const platform = message.platform ?? message.space?.platform ?? "imessage";
    const user = await findOrCreatePogoUser(message.sentBy?.handle ?? senderId, senderId, platform, spaceId);
    // Per Photon's shared-line contract, the reply is sent as the agent
    // identity that received this message; the env id is a fallback only.
    const agentUserId = message.receivedBy?.id ?? getPhotonAgentUserId();

    // First inbound message from a claimed handle proves ownership and
    // activates the assignment.
    const senderHandle = message.sentBy?.handle;
    if (senderHandle) {
      await db("pogo_line_assignments", {
        method: "PATCH",
        query: `handle=eq.${encodeURIComponent(senderHandle)}&status=eq.awaiting_first_message`,
        body: { status: "active", activated_at: new Date().toISOString() },
        prefer: "return=minimal"
      }).catch(() => null);
    }

    // Step 3: persist the inbound message idempotently. A retry of an event
    // that already saved this message continues instead of crashing.
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

    // Step 4: if a previous attempt already sent the reply but crashed before
    // marking the event processed, do not generate or send a second reply.
    const existingReply = await findMessageByProviderId(replyMessageId);
    if (existingReply) {
      await markProcessed();
      return NextResponse.json({ received: true, reply: "already_sent" });
    }

    const sendReply = async (reply: string, metadata: Record<string, unknown>) => {
      const sent = await sendPhotonText(spaceId, agentUserId, reply, messageId, replyMessageId);
      await logMessage({
        userId: user.id,
        providerMessageId: replyMessageId,
        spaceId,
        direction: "outbound",
        platform,
        body: reply,
        status: "sent",
        metadata: { ...metadata, photon: sent }
      });
      return sent;
    };

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
      await sendReply("got it. i cancelled that pending action.", { kind: "cancel" });
      await markProcessed();
      return NextResponse.json({ received: true });
    }

    if (/^approve$/i.test(body)) {
      const result = await approveLatestAction(user.id);
      await sendReply(result, { kind: "approval" });
      await markProcessed();
      return NextResponse.json({ received: true, approval: "processed" });
    }

    const reply = await runPogoAgent({
      userId: user.id,
      message: body,
      phone: message.sentBy?.handle ?? senderId,
      providerMessageId: messageId
    });
    await sendReply(reply, { kind: "agent", content_type: message.content?.type ?? "unknown" });
    await createActivity(user.id, "message_handled", "Pogo replied", reply.slice(0, 500));
    await markProcessed();
    return NextResponse.json({ received: true });
  } catch (error) {
    const detail = error instanceof Error ? error.message.slice(0, 500) : "unknown error";
    console.error(`Photon webhook processing failed for event ${event.id}: ${detail}`);
    // Release the lease and record the failure so Photon's retry can
    // immediately reclaim the event and continue where this attempt stopped.
    await db("pogo_webhook_events", {
      method: "PATCH",
      query: eventKey,
      body: { processing_started_at: null, attempts: (claimed[0].attempts ?? 0) + 1, last_error: detail },
      prefer: "return=minimal"
    }).catch(() => null);
    return NextResponse.json({ error: "Message processing failed." }, { status: 500 });
  }
}
