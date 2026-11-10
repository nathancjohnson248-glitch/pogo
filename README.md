# Pogo

Pogo is a personal agent you can message to get real-world tasks handled.

## Two sides of Pogo

- **Pogo (iMessage):** the personal agent people message through Photon.
- **Pogo Alerts (Telegram):** a private founder operations bot for payments, subscriptions, refunds, and business questions.

Both use lowercase, natural language. The Telegram bot is owner-only and payment-changing actions require explicit confirmation.

## Stack

- Next.js App Router + TypeScript
- Tailwind CSS + Framer Motion
- Supabase for application data and backend services
- Railway for hosting
- Photon for messaging infrastructure
- Anthropic for model access
- Composio and AgentCard for connected-service actions
- HandyPay for billing and signed payment webhooks
- Telegram Bot API for private business alerts

## Telegram setup

Add these Railway variables:

- `TELEGRAM_BOT_TOKEN` — token from BotFather
- `TELEGRAM_WEBHOOK_SECRET` — generated server-side webhook secret
- `POGO_ADMIN_SETUP_TOKEN` — one-time owner claim token
- `SUPABASE_SERVICE_ROLE_KEY` — server-only Supabase service role key

After the bot token is present, register its webhook at:

`https://heypogo.xyz/api/webhooks/telegram`

Use the value of `TELEGRAM_WEBHOOK_SECRET` as Telegram's `secret_token`. The first owner sends `/claim YOUR_SETUP_TOKEN` to the bot. The claim is one-time; other Telegram users cannot access the private bot.

Commands: `/summary`, `/sales`, `/subscriptions`, and `/refund cs_live_...`. Refund requests show a confirmation button before any refund is submitted.

## HandyPay webhook

Register `https://heypogo.xyz/api/webhooks/handypay` with the live HandyPay API key and subscribe to payment, invoice, subscription, refund, and dispute events. Store the endpoint signing secret in `HANDYPAY_WEBHOOK_SECRET`.

## Local development

1. Install Node.js 20.9+.
2. Run `npm install`.
3. Copy `.env.example` to `.env.local` and fill in the values.
4. Run `npm run dev`.

Keep all server credentials private. Never commit real keys or expose them through `NEXT_PUBLIC_*` variables.
