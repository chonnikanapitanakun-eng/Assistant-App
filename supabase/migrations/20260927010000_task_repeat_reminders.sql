-- Repeating tasks and reminder lead time: mirror the sqlite columns added in src/db/migrations/0008
-- so cloud sync round-trips them (calendar_events stay local — see 20260925010000_sync_tables.sql).
alter table public.tasks add column if not exists remind_before integer;
alter table public.tasks add column if not exists repeat text;
alter table public.tasks add column if not exists repeat_from_id text;
