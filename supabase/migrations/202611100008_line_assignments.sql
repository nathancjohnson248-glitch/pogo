-- Shared-line assignments provisioned through Photon, plus an attempt log
-- used for onboarding rate limiting and abuse prevention.
create table if not exists public.pogo_line_assignments (
  id uuid primary key default gen_random_uuid(),
  handle text not null unique,
  assignment_id text not null unique,
  assigned_number text not null,
  claim_ip text,
  status text not null default 'awaiting_first_message'
    check (status in ('awaiting_first_message','active','released')),
  created_at timestamptz not null default now(),
  activated_at timestamptz
);

create table if not exists public.pogo_onboarding_attempts (
  id uuid primary key default gen_random_uuid(),
  ip text,
  handle text,
  outcome text not null,
  created_at timestamptz not null default now()
);

create index if not exists pogo_onboarding_attempts_ip_idx
  on public.pogo_onboarding_attempts(ip, created_at desc);
create index if not exists pogo_onboarding_attempts_created_idx
  on public.pogo_onboarding_attempts(created_at desc);

alter table public.pogo_line_assignments enable row level security;
alter table public.pogo_onboarding_attempts enable row level security;
