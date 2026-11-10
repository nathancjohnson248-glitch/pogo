import { NextRequest, NextResponse } from "next/server";
import { timingSafeEqual } from "node:crypto";
import { hasStoredHandypaySecret, registerHandypayWebhook } from "@/lib/server/handypay";

export const runtime = "nodejs";
export const maxDuration = 30;

function tokenMatches(request: NextRequest) {
  const expected = process.env.POGO_ADMIN_SETUP_TOKEN ?? "";
  const given = request.headers.get("x-pogo-admin-token") ?? request.nextUrl.searchParams.get("token") ?? "";
  if (!expected || !given) return false;
  const a = Buffer.from(given);
  const b = Buffer.from(expected);
  return a.length === b.length && timingSafeEqual(a, b);
}

// One-time infrastructure bootstrap: registers Pogo's webhook endpoint with
// HandyPay through their API and stores the signing secret server-side (it is
// never included in the response). Requires the admin token once a secret
// exists; before that, an unauthenticated call may run exactly this fixed,
// idempotent setup — it can only register our own URL with our own key and
// learns nothing from the response.
export async function POST(request: NextRequest) {
  const authorized = tokenMatches(request);
  if (!authorized) {
    const alreadyConfigured = await hasStoredHandypaySecret();
    if (alreadyConfigured) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  try {
    const result = await registerHandypayWebhook();
    return NextResponse.json({ ok: true, handypay: result });
  } catch (error) {
    // Never echo raw error internals: fetch/header errors can embed header
    // values. Scrub anything secret-shaped before logging, return a generic
    // message to the caller.
    const raw = error instanceof Error ? error.message : "unknown error";
    const scrubbed = raw.replace(/\b(hp|pho|whsec|sk)_[A-Za-z0-9_\-]+/g, "[redacted]").replace(/Bearer\s+\S+/g, "Bearer [redacted]").slice(0, 300);
    console.error(`handypay webhook bootstrap failed: ${scrubbed}`);
    return NextResponse.json({ ok: false, error: "HandyPay registration failed. Check server logs." }, { status: 502 });
  }
}
