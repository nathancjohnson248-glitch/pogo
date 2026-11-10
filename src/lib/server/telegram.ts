import { db } from "./db";

async function telegram(method: string, body: Record<string, unknown>) {
  const token = process.env.TELEGRAM_BOT_TOKEN ?? process.env.TELEGRAM_BOT_API;
  if (!token) return;
  const response = await fetch(`https://api.telegram.org/bot${token}/${method}`, {
    method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(body), cache: "no-store"
  });
  if (!response.ok) throw new Error(`telegram delivery failed: ${response.status}`);
}
function escapeHtml(value: unknown) {
  return String(value ?? "").replace(/[&<>]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;" }[c]!));
}
export async function notifyPogoAdmins(eventType: string, payload: Record<string, any>) {
  const admins = await db<Array<{telegram_chat_id:number}>>("pogo_admins", { query: "select=telegram_chat_id" });
  if (!admins.length) return;
  const data = payload?.data ?? {};
  const email = data.customer_email ?? data.receipt_email ?? data.customer_details?.email ?? data.customer?.email ?? "customer";
  const amount = data.amount_received ?? data.amount_paid ?? data.amount_total ?? data.amount;
  const currency = String(data.currency ?? "usd").toUpperCase();
  const value = Number(amount);
  const formatted = Number.isFinite(value) ? new Intl.NumberFormat("en-US", { style: "currency", currency }).format(value / 100) : "";
  const labels: Record<string,string> = {
    "payment_intent.succeeded": "payment received",
    "invoice.paid": "subscription payment received",
    "customer.subscription.created": "new subscription",
    "customer.subscription.updated": "subscription updated",
    "customer.subscription.deleted": "subscription cancelled",
    "customer.subscription.trial_will_end": "trial ending soon",
    "invoice.payment_failed": "subscription payment failed",
    "payment_intent.payment_failed": "payment failed",
    "charge.refunded": "refund processed",
    "charge.dispute.created": "new payment dispute",
    "charge.dispute.closed": "payment dispute closed"
  };
  const title = labels[eventType];
  if (!title) return;
  const symbol = eventType.includes("refund") ? "↩" : eventType.includes("failed") || eventType.includes("dispute.created") ? "!" : eventType.includes("subscription") ? "↻" : "💰";
  const lines = [`<b>${symbol} ${escapeHtml(title)}</b>`, `\n${escapeHtml(email)}`];
  if (formatted) lines.push(`\n${escapeHtml(formatted)}`);
  const id = data.id ?? data.subscription ?? data.payment_intent ?? data.session_id;
  if (id) lines.push(`\n<code>${escapeHtml(id)}</code>`);
  for (const admin of admins) await telegram("sendMessage", { chat_id: admin.telegram_chat_id, text: lines.join(""), parse_mode: "HTML", disable_web_page_preview: true });
}
