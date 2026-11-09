# Pogo

Pogo is a personal agent you can message to get real-world tasks handled.

## Stack

- Next.js App Router + TypeScript
- Tailwind CSS
- Supabase for application data and backend services
- Railway for hosting
- Photon for messaging infrastructure
- Anthropic for model access
- Composio and AgentCard for connected-service actions
- HandyPay for billing (integration to be added)

## Local development

1. Install Node.js 20.9+.
2. Install dependencies with `npm install`.
3. Copy `.env.example` to `.env.local` and fill in the values you have.
4. Run `npm run dev`.
5. Open http://localhost:3000.

## Railway

Connect this repository to a Railway service and deploy the `main` branch. Railway will detect Next.js and use the package scripts.

Add secrets in Railway's Variables panel. Keep server credentials server-side: never expose provider keys through `NEXT_PUBLIC_*` variables or commit real values to Git.

## Current build status

The first implementation slice includes the public landing page, responsive layout, brand styling, motion, and an interactive messaging demo. Authentication, messaging webhooks, agent execution, integrations, billing, and the signed-in control center are not wired yet. Those will be added against the providers' actual API contracts rather than mocked as working features.