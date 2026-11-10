import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/server/db";
import { createSharedLineAssignment, listSharedLineAssignments } from "@/lib/server/photon";

export const runtime = "nodejs";
export const maxDuration = 30;

// Assignments consume Photon plan capacity, so claiming is rate limited
// per-IP and globally, deduplicated per handle, and never sends anything to
// the number: the visitor proves ownership by texting first (Photon shared
// lines cannot send an unsolicited first message at all).
const PER_IP_DAILY_LIMIT = 3;
const GLOBAL_DAILY_LIMIT = 25;

function normalizePhone(raw: string): string | null {
  const trimmed = raw.trim();
  const digits = trimmed.replace(/[\s().-]/g, "");
  if (/^\+[1-9]\d{1,14}$/.test(digits)) return digits;
  // Bare 10-digit input is treated as a US/Canada number.
  if (/^[2-9]\d{9}$/.test(digits)) return `+1${digits}`;
  if (/^1[2-9]\d{9}$/.test(digits)) return `+${digits}`;
  return null;
}

function clientIp(request: NextRequest) {
  const forwarded = request.headers.get("x-forwarded-for");
  return forwarded?.split(",")[0]?.trim() ?? "unknown";
}

async function countAttempts(sinceIso: string, ip?: string) {
  const ipFilter = ip ? `&ip=eq.${encodeURIComponent(ip)}` : "";
  const rows = await db<Array<{ id: string }>>("pogo_onboarding_attempts", {
    query: `created_at=gte.${encodeURIComponent(sinceIso)}${ipFilter}&outcome=eq.assigned&select=id&limit=${GLOBAL_DAILY_LIMIT + 1}`
  });
  return rows.length;
}

async function recordAttempt(ip: string, handle: string | null, outcome: string) {
  await db("pogo_onboarding_attempts", {
    method: "POST",
    body: { ip, handle, outcome },
    prefer: "return=minimal"
  }).catch(() => null);
}

async function findPhotonAssignmentByHandle(handle: string) {
  let pageToken: string | undefined;
  for (let page = 0; page < 10; page++) {
    const result = await listSharedLineAssignments(pageToken);
    const match = result.assignments.find((a) => a.handle === handle && !a.releasedAt);
    if (match) return match;
    if (!result.nextPageToken) return null;
    pageToken = result.nextPageToken;
  }
  return null;
}

export async function POST(request: NextRequest) {
  const ip = clientIp(request);
  let phoneInput = "";
  try {
    const body = (await request.json()) as { phone?: string };
    phoneInput = String(body.phone ?? "");
  } catch {
    return NextResponse.json({ error: "Send a JSON body with your phone number." }, { status: 400 });
  }

  const handle = normalizePhone(phoneInput);
  if (!handle) {
    return NextResponse.json({ error: "That doesn't look like a valid phone number. Use the full number, like +1 (555) 010-0000." }, { status: 422 });
  }

  // Already assigned? Return the same number — idempotent and free.
  const existing = await db<Array<{ assigned_number: string; status: string }>>("pogo_line_assignments", {
    query: `handle=eq.${encodeURIComponent(handle)}&select=assigned_number,status&limit=1`
  });
  if (existing[0]) {
    return NextResponse.json({ assigned_number: existing[0].assigned_number, existing: true });
  }

  const dayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
  const [ipCount, globalCount] = await Promise.all([countAttempts(dayAgo, ip), countAttempts(dayAgo)]);
  if (ipCount >= PER_IP_DAILY_LIMIT || globalCount >= GLOBAL_DAILY_LIMIT) {
    await recordAttempt(ip, handle, "rate_limited");
    return NextResponse.json({ error: "We're pacing new sign-ups right now. Try again tomorrow, or reach out if it's urgent." }, { status: 429 });
  }

  try {
    let assignment;
    try {
      assignment = await createSharedLineAssignment(handle);
    } catch (error) {
      // 409 means this handle already holds an assignment at Photon that we
      // have no local record of — recover it instead of failing.
      const message = error instanceof Error ? error.message : "";
      if (!message.includes("(409)")) throw error;
      assignment = await findPhotonAssignmentByHandle(handle);
      if (!assignment) throw error;
    }

    await db("pogo_line_assignments", {
      method: "POST",
      query: "on_conflict=handle",
      body: {
        handle,
        assignment_id: assignment.assignmentId,
        assigned_number: assignment.assignedPhoneNumber,
        claim_ip: ip,
        status: "awaiting_first_message"
      },
      prefer: "resolution=merge-duplicates,return=minimal"
    });
    await recordAttempt(ip, handle, "assigned");
    return NextResponse.json({ assigned_number: assignment.assignedPhoneNumber, existing: false });
  } catch (error) {
    const detail = error instanceof Error ? error.message.replace(/\b(pho|whsec|sk|hp)_[A-Za-z0-9_\-]+/g, "[redacted]").slice(0, 300) : "unknown";
    console.error(`shared line claim failed: ${detail}`);
    await recordAttempt(ip, handle, "failed");
    return NextResponse.json({ error: "We couldn't reserve a number right now. Nothing was set up — try again in a bit." }, { status: 502 });
  }
}
