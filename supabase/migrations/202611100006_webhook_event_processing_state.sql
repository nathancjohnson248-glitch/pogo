-- Processing state for retry-safe webhook handling.
-- processing_started_at acts as a lease: a worker claims an event before doing
-- work, and a stale lease (crashed worker) can be reclaimed after it expires.
alter table public.pogo_webhook_events
  add column if not exists processing_started_at timestamptz,
  add column if not exists attempts integer not null default 0,
  add column if not exists last_error text;
