-- Cloud sync (Phase 2): one Postgres table per synced sqlite table (src/db/schema.ts), each owned
-- by `user_id` and readable/writable only by that user (RLS). The app talks to these directly with
-- the Supabase client and the signed-in user's session — no Edge Function in the loop (see
-- src/features/sync). Column names match the sqlite column names 1:1 so the sync engine can convert
-- between them generically (drizzle's `getTableColumns` gives both sides of the mapping).
--
-- `created_at` / `updated_at` / `deleted_at` are epoch-ms integers, same as the sqlite columns —
-- kept as raw numbers so a row round-trips through push/pull without any timezone conversion.
-- There is no `synced_at` column here: that is bookkeeping for the *local* device only.
--
-- calendar_events / calendar_accounts are deliberately not here — those already sync through the
-- `gcal` Edge Function (Google is their source of truth, not this Postgres project).
create table if not exists public.areas (
  id text primary key,
  user_id uuid not null references auth.users (id) on delete cascade,
  created_at bigint not null,
  updated_at bigint not null,
  deleted_at bigint,
  name_th text not null,
  name_en text not null,
  parent_id text,
  color text,
  icon text,
  sort_order integer not null default 0
);

create table if not exists public.contacts (
  id text primary key,
  user_id uuid not null references auth.users (id) on delete cascade,
  created_at bigint not null,
  updated_at bigint not null,
  deleted_at bigint,
  name text not null,
  company text,
  role text,
  email text,
  phone text,
  line_id text,
  area_id text,
  notes text
);

create table if not exists public.routines (
  id text primary key,
  user_id uuid not null references auth.users (id) on delete cascade,
  created_at bigint not null,
  updated_at bigint not null,
  deleted_at bigint,
  title text not null,
  rule text not null,
  period text,
  template jsonb,
  area_id text
);

create table if not exists public.tasks (
  id text primary key,
  user_id uuid not null references auth.users (id) on delete cascade,
  created_at bigint not null,
  updated_at bigint not null,
  deleted_at bigint,
  title text not null,
  notes text,
  date text,
  start_time text,
  end_time text,
  duration_min integer,
  is_done boolean not null default false,
  done_at bigint,
  priority integer not null default 2,
  energy text,
  color text,
  icon text,
  area_id text,
  routine_id text,
  checklist jsonb,
  reminder_at bigint,
  reminder_notification_id text,
  sort_order integer not null default 0
);

create table if not exists public.notes (
  id text primary key,
  user_id uuid not null references auth.users (id) on delete cascade,
  created_at bigint not null,
  updated_at bigint not null,
  deleted_at bigint,
  title text not null default '',
  body text not null default '',
  tags jsonb,
  pinned boolean not null default false,
  attachments jsonb,
  area_id text
);

create table if not exists public.wallets (
  id text primary key,
  user_id uuid not null references auth.users (id) on delete cascade,
  created_at bigint not null,
  updated_at bigint not null,
  deleted_at bigint,
  name text not null,
  type text not null,
  currency text not null default 'THB',
  balance double precision not null default 0,
  color text,
  sort_order integer not null default 0
);

create table if not exists public.categories (
  id text primary key,
  user_id uuid not null references auth.users (id) on delete cascade,
  created_at bigint not null,
  updated_at bigint not null,
  deleted_at bigint,
  name_th text not null,
  name_en text not null,
  type text not null,
  icon text,
  budget_monthly double precision,
  sort_order integer not null default 0
);

create table if not exists public.transactions (
  id text primary key,
  user_id uuid not null references auth.users (id) on delete cascade,
  created_at bigint not null,
  updated_at bigint not null,
  deleted_at bigint,
  wallet_id text not null,
  amount double precision not null,
  currency text not null default 'THB',
  type text not null,
  to_wallet_id text,
  category_id text,
  area_id text,
  date text not null,
  note text,
  slip_image text,
  source text not null default 'manual'
);

create table if not exists public.recurring_bills (
  id text primary key,
  user_id uuid not null references auth.users (id) on delete cascade,
  created_at bigint not null,
  updated_at bigint not null,
  deleted_at bigint,
  name text not null,
  amount double precision not null,
  currency text not null default 'THB',
  wallet_id text,
  category_id text,
  due_day integer not null,
  frequency text not null default 'monthly',
  remind_days_before integer not null default 3,
  is_subscription boolean not null default false,
  due_month integer,
  paid_through text,
  last_payment_id text,
  previous_paid_through text,
  reminder_notification_id text
);

create table if not exists public.checkins (
  id text primary key,
  user_id uuid not null references auth.users (id) on delete cascade,
  created_at bigint not null,
  updated_at bigint not null,
  deleted_at bigint,
  date text not null,
  mood integer,
  energy integer,
  reflection text,
  unique (user_id, date)
);

create table if not exists public.focus_sessions (
  id text primary key,
  user_id uuid not null references auth.users (id) on delete cascade,
  created_at bigint not null,
  updated_at bigint not null,
  deleted_at bigint,
  task_id text,
  started_at bigint not null,
  duration_min integer not null,
  completed boolean not null default false
);

create table if not exists public.assistant_messages (
  id text primary key,
  user_id uuid not null references auth.users (id) on delete cascade,
  created_at bigint not null,
  updated_at bigint not null,
  deleted_at bigint,
  role text not null,
  text text not null default '',
  payload jsonb
);

create table if not exists public.links (
  id text primary key,
  user_id uuid not null references auth.users (id) on delete cascade,
  created_at bigint not null,
  updated_at bigint not null,
  deleted_at bigint,
  from_type text not null,
  from_id text not null,
  to_type text not null,
  to_id text not null,
  relation text
);

-- RLS + the pull cursor index (`user_id, updated_at`) are identical in shape for every table above,
-- so generate them once instead of repeating 13 times.
do $$
declare
  t text;
begin
  foreach t in array array[
    'areas', 'contacts', 'routines', 'tasks', 'notes', 'wallets', 'categories', 'transactions',
    'recurring_bills', 'checkins', 'focus_sessions', 'assistant_messages', 'links'
  ]
  loop
    execute format('alter table public.%I enable row level security', t);
    execute format('create index if not exists %I on public.%I (user_id, updated_at)', t || '_user_updated_idx', t);
    execute format('create policy %I on public.%I for select using (user_id = auth.uid())', t || '_select_own', t);
    execute format('create policy %I on public.%I for insert with check (user_id = auth.uid())', t || '_insert_own', t);
    execute format('create policy %I on public.%I for update using (user_id = auth.uid()) with check (user_id = auth.uid())', t || '_update_own', t);
    execute format('create policy %I on public.%I for delete using (user_id = auth.uid())', t || '_delete_own', t);
  end loop;
end $$;
