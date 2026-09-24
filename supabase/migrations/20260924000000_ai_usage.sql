-- Token usage per AI call (SPEC §6.4: log per user for the premium tier).
-- Written by Edge Functions with the service-role key; users can only read their own rows.
create table if not exists public.ai_usage (
  id            bigint generated always as identity primary key,
  user_id       uuid references auth.users (id) on delete cascade,  -- null until Phase 2 auth
  device_id     text,                                               -- anonymous install id (Phase 1)
  function_name text not null,
  model         text not null,
  input_tokens  integer not null default 0,
  output_tokens integer not null default 0,
  cache_read_tokens     integer not null default 0,
  cache_creation_tokens integer not null default 0,
  latency_ms    integer,
  status        text not null default 'ok',                         -- ok | refusal | invalid | error
  created_at    timestamptz not null default now()
);

create index if not exists ai_usage_user_month_idx on public.ai_usage (user_id, created_at desc);
create index if not exists ai_usage_device_month_idx on public.ai_usage (device_id, created_at desc);

alter table public.ai_usage enable row level security;

drop policy if exists "read own ai usage" on public.ai_usage;
create policy "read own ai usage" on public.ai_usage
  for select to authenticated
  using (user_id = auth.uid());
-- No insert/update policy: only the service role (Edge Functions) writes.

-- Monthly totals per user, for the premium-tier check in the app / dashboard.
create or replace view public.ai_usage_monthly
with (security_invoker = true) as
select
  user_id,
  device_id,
  date_trunc('month', created_at) as month,
  function_name,
  count(*)                      as calls,
  sum(input_tokens)             as input_tokens,
  sum(output_tokens)            as output_tokens
from public.ai_usage
group by user_id, device_id, date_trunc('month', created_at), function_name;
