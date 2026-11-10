import { db } from "./db";

const HANDYPAY_BASE = "https://api.handypay.me/api/v1";
const WEBHOOK_URL = "https://heypogo.xyz/api/webhooks/handypay";
const SECRET_CONFIG_KEY = "handypay_webhook_secret";

// Every event type HandyPay offers; the webhook route records them all and
// the Telegram notifier picks which ones alert the owner.
const ALL_EVENTS = [
  "payment_intent.succeeded",
  "payment_intent.payment_failed",
  "checkout.session.completed",
  "checkout.session.expired",
  "checkout.session.async_payment_succeeded",
  "checkout.session.async_payment_failed",
  "customer.subscription.created",
  "customer.subscription.updated",
  "customer.subscription.deleted",
  "invoice.paid",
  "invoice.payment_failed",
  "customer.subscription.trial_will_end",
  "charge.refunded",
  "charge.dispute.created",
  "charge.dispute.closed"
];

type WebhookEndpoint = {
  id: string;
  url: string;
  events: string[];
  isActive: boolean;
  mode: "test" | "live";
  secret?: string;
  consecutiveFailures?: number;
};

async function handypay<T>(path: string, init: RequestInit = {}): Promise<T> {
  const key = process.env.HANDYPAY_LIVE_API_KEY;
  if (!key) throw new Error("HandyPay is not configured.");
  const response = await fetch(`${HANDYPAY_BASE}${path}`, {
    ...init,
    headers: { authorization: `Bearer ${key}`, "content-type": "application/json", ...(init.headers ?? {}) },
    cache: "no-store"
  });
  const json = (await response.json().catch(() => null)) as { success?: boolean; data?: T; error?: { message?: string } } | null;
  if (!response.ok || !json || json.success === false) {
    throw new Error(`HandyPay request failed (${response.status}): ${json?.error?.message ?? "unknown error"}`);
  }
  return json.data as T;
}

let cachedSecret: { value: string; at: number } | null = null;

// The signing secret: environment variable wins; otherwise the value the app
// stored when it registered the endpoint itself. Cached for five minutes.
export async function getHandypayWebhookSecret(): Promise<string | null> {
  const fromEnv = process.env.HANDYPAY_WEBHOOK_SECRET;
  if (fromEnv) return fromEnv;
  if (cachedSecret && Date.now() - cachedSecret.at < 5 * 60 * 1000) return cachedSecret.value;
  const rows = await db<Array<{ value: string }>>("pogo_app_config", {
    query: `key=eq.${SECRET_CONFIG_KEY}&select=value&limit=1`
  }).catch(() => []);
  if (!rows[0]?.value) return null;
  cachedSecret = { value: rows[0].value, at: Date.now() };
  return rows[0].value;
}

export async function hasStoredHandypaySecret(): Promise<boolean> {
  return (await getHandypayWebhookSecret()) !== null;
}

// Registers (or re-keys) the production webhook endpoint at HandyPay and
// stores the signing secret server-side. The secret is never returned to the
// caller; only non-sensitive endpoint metadata is.
export async function registerHandypayWebhook() {
  const existing = await handypay<WebhookEndpoint[]>("/webhook-endpoints");
  const ours = (existing ?? []).find((endpoint) => endpoint.url === WEBHOOK_URL);

  let endpoint: WebhookEndpoint;
  if (ours) {
    endpoint = await handypay<WebhookEndpoint>(`/webhook-endpoints/${encodeURIComponent(ours.id)}/rotate-secret`, { method: "POST" });
  } else {
    endpoint = await handypay<WebhookEndpoint>("/webhook-endpoints", {
      method: "POST",
      body: JSON.stringify({ url: WEBHOOK_URL, events: ALL_EVENTS })
    });
  }
  if (!endpoint?.secret) throw new Error("HandyPay did not return a signing secret.");

  await db("pogo_app_config", {
    method: "POST",
    query: "on_conflict=key",
    body: { key: SECRET_CONFIG_KEY, value: endpoint.secret, updated_at: new Date().toISOString() },
    prefer: "resolution=merge-duplicates,return=minimal"
  });
  cachedSecret = { value: endpoint.secret, at: Date.now() };

  return {
    endpoint_id: endpoint.id,
    url: endpoint.url,
    mode: endpoint.mode,
    active: endpoint.isActive,
    events: endpoint.events?.length ?? 0,
    rotated: Boolean(ours)
  };
}
