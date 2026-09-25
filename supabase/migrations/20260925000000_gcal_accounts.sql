-- Google Calendar import (P2-07): one row per linked Google account.
-- Written and read only by the `gcal` Edge Function with the service-role key. RLS is on with
-- no policies, so the anon / authenticated roles can never see a refresh token.
--
-- Until Supabase Auth ships, an account belongs to `owner` = sha256(device key) — a random
-- secret the app generates and keeps on the device. Phase 2 auth fills `user_id` instead.
create table if not exists public.gcal_accounts (
  id            uuid primary key default gen_random_uuid(),
  owner         text not null,                                      -- sha256 hex of the device key
  user_id       uuid references auth.users (id) on delete cascade,  -- null until Phase 2 auth
  google_sub    text not null,                                      -- Google account id (stable)
  email         text not null,
  refresh_token text not null,                                      -- AES-GCM, see functions/gcal
  status        text not null default 'ok',                         -- ok | reauth
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now(),
  unique (owner, google_sub)
);

alter table public.gcal_accounts enable row level security;

-- OAuth hand-off: the callback parks the new token here under a one-time ticket, and only the
-- device that started the flow (same owner) can claim it with `finish`. This stops someone from
-- sending a victim a consent link that would attach the victim's calendar to their own device.
create table if not exists public.gcal_pending (
  ticket_hash   text primary key,                                   -- sha256 hex of the ticket
  owner         text not null,
  google_sub    text not null,
  email         text not null,
  refresh_token text not null,
  expires_at    timestamptz not null
);

alter table public.gcal_pending enable row level security;
