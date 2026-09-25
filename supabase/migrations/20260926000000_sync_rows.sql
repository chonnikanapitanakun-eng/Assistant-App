-- Cloud sync (P2-08, SPEC §6.5): one generic row store instead of a mirror of every SQLite table.
-- The app is local-first; the server only keeps each user's rows so other devices can pull them.
--
--   data        the SQLite row as the app read it (column names as in src/db/schema.ts)
--   updated_at  the row's `updated_at` (ms since epoch, set by the device) — conflict = last-write-wins
--   deleted_at  soft delete, same as the app
--   server_seq  bumped on every insert / update; devices pull `server_seq > cursor`
create sequence if not exists public.sync_rows_seq;

create table if not exists public.sync_rows (
  user_id    uuid   not null references auth.users (id) on delete cascade,
  table_name text   not null,
  id         text   not null,
  data       jsonb  not null,
  updated_at bigint not null,
  deleted_at bigint,
  server_seq bigint not null default nextval('public.sync_rows_seq'),
  server_at  timestamptz not null default now(),
  primary key (user_id, table_name, id)
);

create index if not exists sync_rows_user_seq_idx on public.sync_rows (user_id, server_seq);

create or replace function public.sync_rows_touch()
returns trigger
language plpgsql
as $$
begin
  new.server_seq := nextval('public.sync_rows_seq');
  new.server_at := now();
  return new;
end;
$$;

drop trigger if exists sync_rows_touch on public.sync_rows;
create trigger sync_rows_touch
  before update on public.sync_rows
  for each row execute function public.sync_rows_touch();

alter table public.sync_rows enable row level security;

drop policy if exists "read own sync rows" on public.sync_rows;
create policy "read own sync rows" on public.sync_rows
  for select to authenticated
  using (user_id = auth.uid());

drop policy if exists "insert own sync rows" on public.sync_rows;
create policy "insert own sync rows" on public.sync_rows
  for insert to authenticated
  with check (user_id = auth.uid());

drop policy if exists "update own sync rows" on public.sync_rows;
create policy "update own sync rows" on public.sync_rows
  for update to authenticated
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

-- Push: upsert a batch, keeping the newer `updated_at` (last-write-wins).
-- `rows` = [{ "table": "tasks", "id": "…", "data": {…}, "updated_at": 1790000000000, "deleted_at": null }, …]
-- Pushes of one user are serialised with an advisory lock, so their server_seq values commit in
-- order and a device pulling `server_seq > cursor` can never skip a row that commits late.
-- Returns the number of rows the server accepted (older versions are ignored).
create or replace function public.sync_push(rows jsonb)
returns integer
language plpgsql
security invoker
set search_path = public
as $$
declare
  accepted integer;
begin
  if auth.uid() is null then
    raise exception 'not signed in' using errcode = '42501';
  end if;
  perform pg_advisory_xact_lock(hashtext(auth.uid()::text));

  with incoming as (
    select
      r->>'table'                 as table_name,
      r->>'id'                    as id,
      r->'data'                   as data,
      (r->>'updated_at')::bigint  as updated_at,
      (r->>'deleted_at')::bigint  as deleted_at
    from jsonb_array_elements(rows) as r
    where r->>'table' is not null and r->>'id' is not null and r->>'updated_at' is not null
  ),
  upserted as (
    insert into public.sync_rows (user_id, table_name, id, data, updated_at, deleted_at)
    select auth.uid(), table_name, id, data, updated_at, deleted_at from incoming
    on conflict (user_id, table_name, id) do update
      set data = excluded.data, updated_at = excluded.updated_at, deleted_at = excluded.deleted_at
      where excluded.updated_at > public.sync_rows.updated_at
    returning 1
  )
  select count(*) into accepted from upserted;

  return accepted;
end;
$$;

revoke all on function public.sync_push(jsonb) from public, anon;
grant execute on function public.sync_push(jsonb) to authenticated;
