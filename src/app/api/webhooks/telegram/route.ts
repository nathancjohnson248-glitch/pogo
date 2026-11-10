import { NextRequest, NextResponse } from "next/server";
import { createHmac, timingSafeEqual } from "node:crypto";
import Anthropic from "@anthropic-ai/sdk";
import { db } from "@/lib/server/db";
import { handypayApiKey } from "@/lib/server/handypay";

export const runtime = "nodejs";
export const maxDuration = 30;

type TgUser = { id: number; username?: string; first_name?: string };
type TgChat = { id: number; type?: string };
type TgSticker = { file_id: string; emoji?: string; set_name?: string; is_animated?: boolean; is_video?: boolean };
type TgMessage = { message_id: number; chat: TgChat; from?: TgUser; text?: string; caption?: string; sticker?: TgSticker; photo?: Array<{file_id:string}>; video?: {file_id:string}; animation?: {file_id:string}; document?: {file_id:string;mime_type?:string}; voice?: {file_id:string;duration:number}; audio?: {file_id:string;duration:number}; };
type TgReactionUpdate = { chat: TgChat; user?: TgUser; actor_chat?: TgChat; message_id:number; old_reaction?:Array<{type:string;emoji?:string}>; new_reaction?:Array<{type:string;emoji?:string}> };
type TgCallback = { id: string; from: TgUser; data?: string; message?: TgMessage };
type TgUpdate = { update_id: number; message?: TgMessage; callback_query?: TgCallback; message_reaction?: TgReactionUpdate };

function safeEqual(a: string, b: string) {
  const left = Buffer.from(a);
  const right = Buffer.from(b);
  return left.length === right.length && timingSafeEqual(left, right);
}
function esc(value: unknown) {
  return String(value ?? "").replace(/[&<>]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;" }[c]!));
}
function money(amount: unknown, currency: unknown) {
  const n = Number(amount);
  if (!Number.isFinite(n)) return "amount unavailable";
  return new Intl.NumberFormat("en-US", { style: "currency", currency: String(currency ?? "USD").toUpperCase() }).format(n / 100);
}
async function tg(method: string, body: Record<string, unknown>) {
  const token = process.env.TELEGRAM_BOT_TOKEN ?? process.env.TELEGRAM_BOT_API;
  if (!token) throw new Error("telegram bot token is not configured");
  const response = await fetch(`https://api.telegram.org/bot${token}/${method}`, {
    method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(body), cache: "no-store"
  });
  const json = await response.json() as { ok: boolean; description?: string; result?: unknown };
  if (!response.ok || !json.ok) throw new Error(json.description ?? `telegram api error: ${response.status}`);
  return json.result;
}
async function send(chatId: number, text: string, extra: Record<string, unknown> = {}) {
  return tg("sendMessage", { chat_id: chatId, text, parse_mode: "HTML", disable_web_page_preview: true, ...extra });
}
async function isAdmin(chatId: number, userId: number) {
  const rows = await db<Array<{telegram_user_id:number;telegram_chat_id:number}>>("pogo_admins", {
    query: `telegram_chat_id=eq.${chatId}&telegram_user_id=eq.${userId}&select=telegram_user_id,telegram_chat_id&limit=1`
  });
  return rows.length > 0;
}
async function getRecentEvents(hours = 24) {
  const since = new Date(Date.now() - hours * 60 * 60 * 1000).toISOString();
  return db<Array<{event_type:string;payload:Record<string,any>;created_at:string}>>("pogo_webhook_events", {
    query: `provider=eq.handypay&created_at=gte.${encodeURIComponent(since)}&select=event_type,payload,created_at&order=created_at.desc&limit=100`
  });
}
async function salesSummary() {
  const events = await getRecentEvents(24);
  const paid = events.filter((e) => ["payment_intent.succeeded","invoice.paid","checkout.session.completed"].includes(e.event_type));
  const subs = events.filter((e) => e.event_type.startsWith("customer.subscription."));
  const refunds = events.filter((e) => e.event_type === "charge.refunded");
  const failures = events.filter((e) => ["invoice.payment_failed","payment_intent.payment_failed","checkout.session.async_payment_failed"].includes(e.event_type));
  const lines = paid.slice(0, 8).map((e) => {
    const d = e.payload?.data ?? {};
    const amount = d.amount_received ?? d.amount_paid ?? d.amount_total ?? d.amount;
    const email = d.customer_email ?? d.receipt_email ?? d.customer_details?.email ?? "customer";
    return `• ${esc(money(amount, d.currency))} · ${esc(email)}`;
  });
  return [
    "<b>pogo · last 24 hours</b>",
    `\n💰 successful payment events: <b>${paid.length}</b>`,
    `\n↻ subscription events: <b>${subs.length}</b>`,
    `\n↩ refunds: <b>${refunds.length}</b>`,
    `\n⚠️ failed payments: <b>${failures.length}</b>`,
    lines.length ? `\n\n<b>recent payments</b>\n${lines.join("\n")}` : "\n\nno payment events recorded yet."
  ].join("");
}
async function listSubscriptions() {
  const key = handypayApiKey();
  if (!key) return "handypay live api key is not configured yet.";
  const response = await fetch("https://api.handypay.me/api/v1/subscriptions?limit=20", {
    headers: { authorization: `Bearer ${key}` }, cache: "no-store"
  });
  const json = await response.json() as any;
  if (!response.ok || json.success === false) throw new Error(json?.error?.message ?? "could not load subscriptions");
  const data = json.data?.data ?? json.data?.subscriptions ?? json.data ?? [];
  if (!Array.isArray(data) || !data.length) return "no subscriptions came back from handypay.";
  return "<b>active subscription snapshot</b>\n\n" + data.slice(0, 15).map((s: any) =>
    `• <b>${esc(s.customer_email ?? s.customer?.email ?? "customer")}</b> · ${esc(s.status ?? "unknown")} · ${esc(s.id ?? "")}`
  ).join("\n");
}
async function draftRefund(chatId: number, sessionId: string) {
  if (!/^cs_live_[A-Za-z0-9_]+$/.test(sessionId)) {
    await send(chatId, "send a valid checkout session id, like <code>cs_live_...</code>. i won't guess which payment you mean.");
    return;
  }
  const rows = await db<Array<{id:string}>>("pogo_admin_actions", {
    method: "POST",
    body: { telegram_chat_id: chatId, action_type: "refund", payload: { session_id: sessionId }, status: "pending" }
  });
  const id = rows[0]?.id;
  if (!id) throw new Error("could not save refund approval");
  await send(chatId, `<b>refund approval</b>\n\ncheckout: <code>${esc(sessionId)}</code>\n\nthis will request a full refund. confirm only if this is the correct customer and payment.`, {
    reply_markup: { inline_keyboard: [[
      { text: "confirm full refund", callback_data: `refund:yes:${id}` },
      { text: "cancel", callback_data: `refund:no:${id}` }
    ]] }
  });
}
async function completeRefund(chatId: number, actionId: string, confirm: boolean) {
  const rows = await db<Array<{id:string;payload:Record<string,string>;status:string;expires_at:string}>>("pogo_admin_actions", {
    query: `id=eq.${actionId}&telegram_chat_id=eq.${chatId}&status=eq.pending&select=id,payload,status,expires_at&limit=1`
  });
  const action = rows[0];
  if (!action) return "that refund request is no longer pending.";
  if (new Date(action.expires_at).getTime() < Date.now()) {
    await db("pogo_admin_actions", { method: "PATCH", query: `id=eq.${actionId}`, body: { status: "expired" } });
    return "that confirmation expired. create a fresh refund request if you still need it.";
  }
  if (!confirm) {
    const cancelled = await db<Array<{id:string}>>("pogo_admin_actions", {
      method: "PATCH",
      query: `id=eq.${actionId}&telegram_chat_id=eq.${chatId}&status=eq.pending&select=id`,
      body: { status: "cancelled" }
    });
    return cancelled.length ? "refund cancelled. nothing was sent to handypay." : "that refund request was already handled.";
  }
  const key = handypayApiKey();
  if (!key) return "handypay live api key is not configured.";
  const claimed = await db<Array<{id:string}>>("pogo_admin_actions", {
    method: "PATCH",
    query: `id=eq.${actionId}&telegram_chat_id=eq.${chatId}&status=eq.pending&select=id`,
    body: { status: "confirmed" }
  });
  if (!claimed.length) return "that refund request was already handled. i won't submit it twice.";
  const response = await fetch("https://api.handypay.me/api/v1/refunds", {
    method: "POST",
    headers: { authorization: `Bearer ${key}`, "content-type": "application/json" },
    body: JSON.stringify({ session_id: action.payload.session_id, reason: "requested_by_customer" }),
    cache: "no-store"
  });
  const json = await response.json() as any;
  if (!response.ok || json.success === false) {
    await db("pogo_admin_actions", { method: "PATCH", query: `id=eq.${actionId}`, body: { status: "failed", completed_at: new Date().toISOString() } });
    throw new Error(json?.error?.message ?? "handypay rejected the refund");
  }
  await db("pogo_admin_actions", { method: "PATCH", query: `id=eq.${actionId}`, body: { status: "completed", completed_at: new Date().toISOString() } });
  return `refund request submitted. handypay reference: <code>${esc(json.data?.id ?? json.data?.refund?.id ?? "created")}</code>. i'll send another alert when the refund event is confirmed.`;
}
async function askPogo(question: string) {
  const events = await getRecentEvents(24);
  const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
  const compact = events.slice(0, 60).map((e) => ({ type: e.event_type, data: e.payload?.data ?? {}, at: e.created_at }));
  const result = await anthropic.messages.create({
    model: process.env.ANTHROPIC_MODEL ?? "claude-sonnet-4-5",
    max_tokens: 500,
    system: "you are pogo, the founder's private business-sidekick. answer in lowercase only, naturally and briefly. use only the supplied handypay events. if the data does not contain an answer, say so. never invent revenue, customers, or payment status. never claim you issued a refund or changed a subscription. for actions, tell the founder to use /refund with the exact checkout session id. you may summarize trends but clearly label estimates.",
    messages: [{ role: "user", content: `question: ${question}\n\nverified handypay events from the last 24 hours:\n${JSON.stringify(compact)}` }]
  });
  return result.content.filter((b) => b.type === "text").map((b) => b.text).join("\n").toLowerCase().slice(0, 3500);
}
async function handleMessage(message: TgMessage) {
  const chatId = message.chat.id;
  const user = message.from;
  const mediaNote = message.sticker ? `\n[sticker${message.sticker.emoji ? ` ${message.sticker.emoji}` : ""}${message.sticker.set_name ? ` from ${message.sticker.set_name}` : ""}${message.sticker.is_animated ? ", animated" : message.sticker.is_video ? ", video sticker" : ""}]` : message.photo ? "\n[photo attached]" : message.video ? "\n[video attached]" : message.animation ? "\n[animation attached]" : message.voice ? `\n[voice note, ${message.voice.duration}s]` : message.audio ? `\n[audio attached, ${message.audio.duration}s]` : message.document ? `\n[file attached${message.document.mime_type ? `, ${message.document.mime_type}` : ""}]` : "";
  const text = (message.text ?? message.caption ?? "").trim() + mediaNote;
  if (!user || message.chat.type !== "private") return;
  if (text.startsWith("/claim ")) {
    const token = text.slice(7).trim();
    const expected = process.env.POGO_ADMIN_SETUP_TOKEN ?? "";
    if (!expected || !safeEqual(token, expected)) {
      await send(chatId, "that setup code isn't valid.");
      return;
    }
    const existing = await db<Array<{id:string}>>("pogo_admins", { query: "select=id&limit=1" });
    if (existing.length) {
      const own = await db<Array<{id:string}>>("pogo_admins", { query: `telegram_user_id=eq.${user.id}&select=id&limit=1` });
      await send(chatId, own.length ? "you're already connected. i'm right here." : "this bot already has an owner connected. ask the owner to reset access.");
      return;
    }
    await db("pogo_admins", { method: "POST", body: { telegram_user_id: user.id, telegram_chat_id: chatId, username: user.username ?? null }, prefer: "return=minimal" });
    await send(chatId, "we're connected. i'm pogo. i'll keep an eye on the business side and bring you the important stuff, not noise.\n\ntry /help to see what i can do.");
    return;
  }
  if (!(await isAdmin(chatId, user.id))) {
    await send(chatId, "hey. i'm pogo alerts, the private business bot. the owner needs to connect me first.");
    return;
  }
  const lower = text.toLowerCase();
  if (lower === "/start" || lower === "/help") {
    await send(chatId, "<b>pogo alerts</b>\n\n/summary · business snapshot\n/sales · payments from the last 24h\n/subscriptions · current subscriptions\n/refund cs_live_... · prepare a refund for your confirmation\n\nask me questions normally too. i'll use the payment events i can verify. all lowercase, no noise.");
    return;
  }
  if (lower === "/summary" || lower === "/sales") {
    await send(chatId, await salesSummary());
    return;
  }
  if (lower === "/subscriptions") {
    await send(chatId, await listSubscriptions());
    return;
  }
  if (lower.startsWith("/refund ")) {
    await draftRefund(chatId, text.split(/\s+/)[1] ?? "");
    return;
  }
  if (!text) return;
  const answer = await askPogo(text);
  await send(chatId, answer);
}
export async function POST(request: NextRequest) {
  const expected = process.env.TELEGRAM_WEBHOOK_SECRET;
  const supplied = request.headers.get("x-telegram-bot-api-secret-token") ?? "";
  if (!expected || !safeEqual(supplied, expected)) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  let update: TgUpdate;
  try { update = await request.json() as TgUpdate; } catch { return NextResponse.json({ error: "invalid json" }, { status: 400 }); }
  try {
    if (update.callback_query) {
      const cb = update.callback_query;
      const chatId = cb.message?.chat.id;
      if (!chatId || !(await isAdmin(chatId, cb.from.id))) return NextResponse.json({ ok: true });
      const [kind, decision, actionId] = (cb.data ?? "").split(":");
      if (kind === "refund" && actionId) {
        const result = await completeRefund(chatId, actionId, decision === "yes");
        await tg("answerCallbackQuery", { callback_query_id: cb.id, text: decision === "yes" ? "refund confirmation received" : "cancelled" });
        await send(chatId, result);
      }
    } else if (update.message) {
      await handleMessage(update.message);
    } else if (update.message_reaction) {
      const reaction = update.message_reaction;
      const actorId = reaction.user?.id;
      if (actorId && await isAdmin(reaction.chat.id, actorId)) {
        const emoji = (reaction.new_reaction ?? []).map((item) => item.emoji ?? item.type).join(" ") || "removed reaction";
        await send(reaction.chat.id, "i saw your reaction " + esc(emoji) + " on message #" + reaction.message_id + ".");
      }
    }
    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error("pogo alerts webhook failed", error);
    const chatId = update.message?.chat.id ?? update.callback_query?.message?.chat.id ?? update.message_reaction?.chat.id;
    if (chatId) await send(chatId, "something went wrong on my side. nothing will be marked as complete until i can verify it.").catch(() => null);
    return NextResponse.json({ ok: true });
  }
}

export async function GET(request: NextRequest) {
  const key = request.nextUrl.searchParams.get("key") ?? "";
  const expected = process.env.POGO_ADMIN_SETUP_TOKEN ?? "";
  if (!expected || !safeEqual(key, expected)) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  if (!(process.env.TELEGRAM_BOT_TOKEN ?? process.env.TELEGRAM_BOT_API) || !process.env.TELEGRAM_WEBHOOK_SECRET) {
    return NextResponse.json({ error: "add TELEGRAM_BOT_TOKEN to Railway first" }, { status: 503 });
  }
  try {
    const result = await tg("setWebhook", {
      url: "https://heypogo.xyz/api/webhooks/telegram",
      secret_token: process.env.TELEGRAM_WEBHOOK_SECRET,
      allowed_updates: ["message", "callback_query", "message_reaction"],
      drop_pending_updates: false
    });
    return NextResponse.json({ ok: true, webhook: result, next: "open your bot and send /claim with the owner setup token" });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "could not register telegram webhook" }, { status: 502 });
  }
}
