const SUPABASE_URL = process.env.SUPABASE_URL ?? process.env.NEXT_PUBLIC_SUPABASE_URL;
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

function config() {
  if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) throw new Error("pogo database is not configured.");
  return { url: SUPABASE_URL.replace(/\/$/, ""), key: SUPABASE_SERVICE_ROLE_KEY };
}

export async function db<T = unknown>(table: string, options: { method?: "GET" | "POST" | "PATCH" | "DELETE"; query?: string; body?: unknown; prefer?: string } = {}): Promise<T> {
  const { url, key } = config();
  const response = await fetch(`${url}/rest/v1/${table}${options.query ? `?${options.query}` : ""}`, {
    method: options.method ?? "GET",
    headers: { apikey: key, Authorization: `Bearer ${key}`, "Content-Type": "application/json", Prefer: options.prefer ?? "return=representation" },
    ...(options.body === undefined ? {} : { body: JSON.stringify(options.body) }),
    cache: "no-store"
  });
  const text = await response.text();
  if (!response.ok) throw new Error(`database request failed (${response.status}): ${text.slice(0, 500)}`);
  return (text ? JSON.parse(text) : null) as T;
}

export async function findOrCreatePogoUser(phone: string | null, photonUserId: string, platform: string, spaceId: string) {
  const normalizedPhone = phone && /^\+[1-9]\d{7,14}$/.test(phone.trim()) ? phone.trim() : null;
  const existing = await db<Array<{id:string}>>("pogo_users", { query: `photon_user_id=eq.${encodeURIComponent(photonUserId)}&select=id&limit=1` });
  if (existing[0]) {
    const updated = await db<Array<{id:string}>>("pogo_users", { method: "PATCH", query: `id=eq.${existing[0].id}&select=id`, body: { phone_e164: normalizedPhone, photon_platform: platform, photon_space_id: spaceId, last_seen_at: new Date().toISOString() } });
    return updated[0] ?? existing[0];
  }
  const created = await db<Array<{id:string}>>("pogo_users", { method: "POST", body: { phone_e164: normalizedPhone, photon_user_id: photonUserId, photon_platform: platform, photon_space_id: spaceId, last_seen_at: new Date().toISOString() } });
  return created[0];
}

// Idempotent by provider_message_id: replaying the same provider message is a
// no-op instead of a unique-constraint violation. Returns the inserted row, or
// an empty array when the message was already persisted.
export async function logMessage(input: { userId: string; providerMessageId: string; spaceId: string; direction: "inbound" | "outbound"; platform: string; body: string; status?: string; metadata?: Record<string, unknown> }) {
  return db<Array<{ id: string }>>("pogo_messages", {
    method: "POST",
    query: "on_conflict=provider_message_id&select=id",
    body: { user_id: input.userId, provider_message_id: input.providerMessageId, space_id: input.spaceId, direction: input.direction, platform: input.platform, body: input.body, status: input.status ?? "received", metadata: input.metadata ?? {} },
    prefer: "return=representation,resolution=ignore-duplicates"
  });
}

export async function findMessageByProviderId(providerMessageId: string) {
  const rows = await db<Array<{ id: string; direction: string; status: string }>>("pogo_messages", {
    query: `provider_message_id=eq.${encodeURIComponent(providerMessageId)}&select=id,direction,status&limit=1`
  });
  return rows[0] ?? null;
}

export async function createActivity(userId: string, kind: string, title: string, detail?: string, missionId?: string) {
  return db("pogo_activity", { method: "POST", body: { user_id: userId, kind, title, detail: detail ?? null, mission_id: missionId ?? null }, prefer: "return=minimal" });
}

export async function getRecentMemories(userId: string) {
  return db<Array<{memory:string;category:string}>>("pogo_memories", { query: `user_id=eq.${userId}&active=eq.true&select=memory,category&order=confidence.desc&limit=20` });
}

export async function getRecentMessages(userId: string, excludeProviderMessageId?: string) {
  const exclusion = excludeProviderMessageId ? `&provider_message_id=neq.${encodeURIComponent(excludeProviderMessageId)}` : "";
  return db<Array<{direction:"inbound"|"outbound";body:string;platform:string;created_at:string}>>("pogo_messages", { query: `user_id=eq.${userId}${exclusion}&select=direction,body,platform,created_at&order=created_at.desc&limit=20` });
}
