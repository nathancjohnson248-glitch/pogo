import { NextRequest, NextResponse } from "next/server";
import { createHmac, timingSafeEqual } from "node:crypto";
import { db } from "@/lib/server/db";
import { notifyPogoAdmins } from "@/lib/server/telegram";

export const runtime = "nodejs";

function validSignature(payload: string, secret: string, signature: string) {
  if (!signature.startsWith("sha256=")) return false;
  const hex = signature.slice(7);
  if (!/^[0-9a-f]{64}$/i.test(hex)) return false;
  const expected = createHmac("sha256", secret).update(payload).digest();
  const received = Buffer.from(hex, "hex");
  return received.length === expected.length && timingSafeEqual(received, expected);
}

export async function POST(request: NextRequest) {
  const secret = process.env.HANDYPAY_WEBHOOK_SECRET;
  if (!secret) return NextResponse.json({ error: "HandyPay webhook is not configured." }, { status: 503 });
  const raw = await request.text();
  if (!validSignature(raw, secret, request.headers.get("x-handypay-signature") ?? "")) {
    return NextResponse.json({ error: "Invalid signature." }, { status: 401 });
  }
  let event: {id?:string;type?:string;data?:Record<string,unknown>};
  try { event = JSON.parse(raw); } catch {
    return NextResponse.json({ error: "Invalid JSON." }, { status: 400 });
  }
  if (!event.id || !event.type) return NextResponse.json({ error: "Malformed event." }, { status: 400 });

  const inserted = await db<Array<{id:string}>>("pogo_webhook_events", {
    method: "POST",
    query: "on_conflict=provider,provider_event_id&select=id",
    body: { provider: "handypay", provider_event_id: event.id, event_type: event.type, payload: event, processed_at: new Date().toISOString() },
    prefer: "return=representation,resolution=ignore-duplicates"
  });
  if (inserted.length) {
    try { await notifyPogoAdmins(event.type, event as unknown as Record<string, any>); }
    catch (error) { console.error("pogo alerts delivery failed", error); }
  }
  return NextResponse.json({ received: true, duplicate: !inserted.length });
}
