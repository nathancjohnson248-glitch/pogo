-- Server-managed configuration values (e.g. webhook signing secrets obtained
-- programmatically). Service-role access only; RLS enabled with no policies.
create table if not exists public.pogo_app_config (
  key text primary key,
  value text not null,
  updated_at timestamptz not null default now()
);

alter table public.pogo_app_config enable row level security;
