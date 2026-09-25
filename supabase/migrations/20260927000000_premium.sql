-- Premium tier (P4-06). Free = planner + notes + money (on-device, no AI, no cloud sync).
-- Pro  = AI (ai-capture / assistant / slip-ocr, monthly fair-use cap) + cloud sync.
--
-- `entitlements` is written only by the `premium` Edge Function (RevenueCat webhook / refresh) with the
-- service-role key, or by hand for comp accounts:
--   insert into public.entitlements (user_id, source, active) values ('<auth user id>', 'manual', true)
--   on conflict (user_id) do update set source = 'manual', active = true, expires_at = null;
-- A 'manual' row is never overwritten by RevenueCat.
create table if not exists public.entitlements (
  user_id      uuid primary key references auth.users (id) on delete cascade,
  entitlement  text not null default 'pro',
  source       text not null default 'revenuecat' check (source in ('revenuecat', 'manual')),
  active       boolean not null default false,
  expires_at   timestamptz,          -- null = no end (lifetime purchase / manual grant)
  product_id   text,
  store        text,                 -- app_store | play_store | stripe | rc_billing | promotional …
  period_type  text,                 -- normal | trial | intro
  will_renew   boolean,
  updated_at   timestamptz not null default now()
);

alter table public.entitlements enable row level security;

drop policy if exists "read own entitlement" on public.entitlements;
create policy "read own entitlement" on public.entitlements
  for select to authenticated
  using (user_id = auth.uid());
-- No insert/update policy: only the service role writes.

-- Pro check for RLS (the caller's own status only, so it can't be used to probe other users).
create or replace function public.is_pro()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.entitlements e
    where e.user_id = auth.uid()
      and e.entitlement = 'pro'
      and e.active
      and (e.expires_at is null or e.expires_at > now())
  );
$$;

revoke all on function public.is_pro() from public, anon;
grant execute on function public.is_pro() to authenticated;

-- Cloud sync is Pro: pushing (insert / update) needs an active entitlement. Reading and deleting your
-- own rows stay open, so a lapsed subscriber can still restore to a new device or wipe their data (PDPA).
do $$
declare
  t text;
begin
  foreach t in array array[
    'areas', 'contacts', 'routines', 'tasks', 'notes', 'wallets', 'categories', 'transactions',
    'recurring_bills', 'checkins', 'focus_sessions', 'assistant_messages', 'links'
  ] loop
    execute format('drop policy if exists %I on public.%I', t || '_insert_own', t);
    execute format('drop policy if exists %I on public.%I', t || '_update_own', t);
    execute format('create policy %I on public.%I for insert with check (user_id = auth.uid() and public.is_pro())', t || '_insert_own', t);
    execute format('create policy %I on public.%I for update using (user_id = auth.uid()) with check (user_id = auth.uid() and public.is_pro())', t || '_update_own', t);
  end loop;
end $$;
