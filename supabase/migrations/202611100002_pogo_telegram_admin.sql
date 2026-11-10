create table if not exists public.pogo_admins (
  id uuid primary key default gen_random_uuid(),
  telegram_user_id bigint not null unique,
  telegram_chat_id bigint not null unique,
  username text,
  claimed_at timestamptz not null default now()
);
create table if not exists public.pogo_admin_actions (
  id uuid primary key default gen_random_uuid(),
  telegram_chat_id bigint not null,
  action_type text not null,
  payload jsonb not null default '{}'::jsonb,
  status text not null default 'pending' check (status in ('pending','confirmed','cancelled','completed','failed','expired')),
  expires_at timestamptz not null default (now() + interval '10 minutes'),
  created_at timestamptz not null default now(),
  completed_at timestamptz
);
create index if not exists pogo_admin_actions_chat_status_idx on public.pogo_admin_actions(telegram_chat_id,status,created_at desc);
alter table public.pogo_admins enable row level security;
alter table public.pogo_admin_actions enable row level security;
