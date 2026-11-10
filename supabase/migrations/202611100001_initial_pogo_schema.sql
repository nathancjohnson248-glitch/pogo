-- Pogo's application data. All access is server-side through the service role.
create extension if not exists pgcrypto;

create table if not exists public.pogo_users (
  id uuid primary key default gen_random_uuid(),
  phone_e164 text not null unique,
  display_name text,
  photon_user_id text,
  photon_platform text not null default 'imessage',
  photon_space_id text,
  timezone text,
  locale text,
  preferences jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  last_seen_at timestamptz
);

create unique index if not exists pogo_users_photon_user_id_idx
  on public.pogo_users(photon_user_id) where photon_user_id is not null;

create table if not exists public.pogo_messages (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.pogo_users(id) on delete cascade,
  provider_message_id text unique,
  space_id text,
  direction text not null check (direction in ('inbound','outbound')),
  platform text not null default 'imessage',
  body text not null,
  status text not null default 'received',
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index if not exists pogo_messages_user_created_idx
  on public.pogo_messages(user_id, created_at desc);

create table if not exists public.pogo_missions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.pogo_users(id) on delete cascade,
  title text not null,
  request text not null,
  status text not null default 'queued'
    check (status in ('queued','planning','running','waiting_approval','completed','failed','canceled')),
  plan jsonb not null default '[]'::jsonb,
  result text,
  error text,
  idempotency_key text unique,
  started_at timestamptz,
  completed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists pogo_missions_user_created_idx
  on public.pogo_missions(user_id, created_at desc);

create table if not exists public.pogo_activity (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.pogo_users(id) on delete cascade,
  mission_id uuid references public.pogo_missions(id) on delete set null,
  kind text not null,
  title text not null,
  detail text,
  status text not null default 'info',
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index if not exists pogo_activity_user_created_idx
  on public.pogo_activity(user_id, created_at desc);

create table if not exists public.pogo_approvals (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.pogo_users(id) on delete cascade,
  mission_id uuid references public.pogo_missions(id) on delete cascade,
  action text not null,
  description text not null,
  tool_slug text,
  tool_arguments jsonb not null default '{}'::jsonb,
  status text not null default 'pending'
    check (status in ('pending','approved','rejected','expired','executed')),
  expires_at timestamptz,
  decided_at timestamptz,
  created_at timestamptz not null default now()
);

create index if not exists pogo_approvals_user_status_idx
  on public.pogo_approvals(user_id, status, created_at desc);

create table if not exists public.pogo_connections (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.pogo_users(id) on delete cascade,
  toolkit text not null,
  composio_connected_account_id text,
  status text not null default 'pending',
  account_label text,
  scopes text[] not null default '{}',
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(user_id, toolkit, composio_connected_account_id)
);

create table if not exists public.pogo_memories (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.pogo_users(id) on delete cascade,
  memory text not null,
  category text not null default 'general',
  source text not null default 'conversation',
  confidence numeric(4,3) not null default 0.8 check (confidence between 0 and 1),
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists pogo_memories_user_active_idx
  on public.pogo_memories(user_id, active, category);

create table if not exists public.pogo_subscriptions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null unique references public.pogo_users(id) on delete cascade,
  handypay_customer_id text,
  handypay_subscription_id text unique,
  plan_code text not null default 'free',
  status text not null default 'inactive',
  current_period_end timestamptz,
  cancel_at_period_end boolean not null default false,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.pogo_webhook_events (
  id uuid primary key default gen_random_uuid(),
  provider text not null,
  provider_event_id text not null,
  event_type text not null,
  payload jsonb not null default '{}'::jsonb,
  processed_at timestamptz,
  created_at timestamptz not null default now(),
  unique(provider, provider_event_id)
);

create table if not exists public.pogo_agent_sessions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.pogo_users(id) on delete cascade,
  composio_session_id text,
  last_message_at timestamptz,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(user_id)
);

create or replace function public.pogo_set_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

do $$
declare t text;
begin
  foreach t in array array['pogo_users','pogo_missions','pogo_connections','pogo_memories','pogo_subscriptions','pogo_agent_sessions']
  loop
    execute format('drop trigger if exists %I_updated_at on public.%I', t, t);
    execute format('create trigger %I_updated_at before update on public.%I for each row execute function public.pogo_set_updated_at()', t, t);
  end loop;
end $$;

alter table public.pogo_users enable row level security;
alter table public.pogo_messages enable row level security;
alter table public.pogo_missions enable row level security;
alter table public.pogo_activity enable row level security;
alter table public.pogo_approvals enable row level security;
alter table public.pogo_connections enable row level security;
alter table public.pogo_memories enable row level security;
alter table public.pogo_subscriptions enable row level security;
alter table public.pogo_webhook_events enable row level security;
alter table public.pogo_agent_sessions enable row level security;

-- No public/anon policies. The application server uses the service role.
