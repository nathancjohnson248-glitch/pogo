import { NextRequest, NextResponse } from "next/server";
import { timingSafeEqual } from "node:crypto";
import { createComposioSession } from "@/lib/server/composio";
import { db } from "@/lib/server/db";
import { hasStoredHandypaySecret } from "@/lib/server/handypay";

export const runtime = "nodejs";
export const maxDuration = 30;

function authorized(request: NextRequest) {
  const expected = process.env.POGO_ADMIN_SETUP_TOKEN ?? "";
  const given = request.headers.get("x-pogo-admin-token") ?? request.nextUrl.searchParams.get("token") ?? "";
  if (!expected || !given) return false;
  const a = Buffer.from(given);
  const b = Buffer.from(expected);
  return a.length === b.length && timingSafeEqual(a, b);
}

export async function GET(request: NextRequest) {
  const handypayConfigured = Boolean(process.env.HANDYPAY_LIVE_API_KEY) && (await hasStoredHandypaySecret().catch(() => false));
  const base = {
    ok: true,
    app: "pogo",
    configured: {
      anthropic: Boolean(process.env.ANTHROPIC_API_KEY),
      composio: Boolean(process.env.COMPOSIO_API_KEY),
      photon: Boolean(process.env.PHOTON_API_KEY && process.env.PHOTON_PROJECT_ID),
      photonWebhook: Boolean(process.env.PHOTON_WEBHOOK_SECRET),
      supabase: Boolean(process.env.SUPABASE_URL && process.env.SUPABASE_SERVICE_ROLE_KEY),
      handypay: handypayConfigured,
      telegram: Boolean(process.env.TELEGRAM_BOT_TOKEN ?? process.env.TELEGRAM_BOT_API)
    }
  };

  const check = request.nextUrl.searchParams.get("check");
  if (!check) return NextResponse.json(base);
  if (!authorized(request)) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  if (check === "composio") {
    try {
      const session = await createComposioSession("pogo-healthcheck");
      return NextResponse.json({ ...base, composio_session: { ok: true, session_id_present: Boolean(session.session_id) } });
    } catch (error) {
      const detail = error instanceof Error ? error.message : "unknown error";
      return NextResponse.json({ ...base, composio_session: { ok: false, error: detail } }, { status: 502 });
    }
  }

  if (check === "db") {
    try {
      await db("pogo_webhook_events", { query: "select=id&limit=1" });
      return NextResponse.json({ ...base, db: { ok: true } });
    } catch (error) {
      const detail = error instanceof Error ? error.message : "unknown error";
      return NextResponse.json({ ...base, db: { ok: false, error: detail } }, { status: 502 });
    }
  }

  return NextResponse.json({ error: "unknown check" }, { status: 400 });
}
