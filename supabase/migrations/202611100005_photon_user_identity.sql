alter table public.pogo_users alter column phone_e164 drop not null;
create index if not exists pogo_users_photon_user_id_lookup_idx on public.pogo_users(photon_user_id);
