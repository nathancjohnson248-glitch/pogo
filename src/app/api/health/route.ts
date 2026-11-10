import { NextResponse } from "next/server";

export const runtime = "nodejs";

export async function GET() {
  return NextResponse.json({
    ok: true,
    app: "pogo",
    configured: {
      anthropic: Boolean(process.env.ANTHROPIC_API_KEY),
      composio: Boolean(process.env.COMPOSIO_API_KEY),
      photon: Boolean(process.env.PHOTON_API_KEY && process.env.PHOTON_PROJECT_ID),
      photonWebhook: Boolean(process.env.PHOTON_WEBHOOK_SECRET),
      supabase: Boolean(process.env.SUPABASE_URL && process.env.SUPABASE_SERVICE_ROLE_KEY),
      handypay: Boolean(process.env.HANDYPAY_LIVE_API_KEY && process.env.HANDYPAY_WEBHOOK_SECRET),
      agentcard: Boolean(process.env.AGENTCARD_API_KEY)
    }
  });
}
