-- Gmail (P4-01): Google accounts linked for the Inbox screen, through Gmail's own OAuth client
-- (a separate Google Cloud project kept in Testing mode, so the verified Calendar app never asks
-- for Gmail's restricted scopes). Same shape and rules as gcal_accounts / gcal_pending:
-- written and read only by the `gmail` Edge Function with the service-role key; RLS on, no policies.
-- No mail content is ever stored — only the encrypted refresh token.
create table if not exists public.gmail_accounts (
  id            uuid primary key default gen_random_uuid(),
  owner         text not null,                                      -- sha256 hex of the device key
  google_sub    text not null,
  email         text not null,
  refresh_token text not null,                                      -- AES-GCM, see _shared/google.ts
  status        text not null default 'ok',                         -- ok | reauth
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now(),
  unique (owner, google_sub)
);

alter table public.gmail_accounts enable row level security;

-- One-time ticket from the OAuth callback; only the device that started the flow can claim it.
create table if not exists public.gmail_pending (
  ticket_hash   text primary key,
  owner         text not null,
  google_sub    text not null,
  email         text not null,
  refresh_token text not null,
  expires_at    timestamptz not null
);

alter table public.gmail_pending enable row level security;
