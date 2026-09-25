-- Routines (P2-04): mirror the sqlite column added in src/db/migrations/0007 so cloud sync
-- round-trips it (column names match the sqlite ones 1:1 — see 20260925010000_sync_tables.sql).
-- Tasks a routine generates get a deterministic id (`<routine_id>_<date>`, src/features/routines/model.ts),
-- so two devices generating the same day's task upsert the same row here.
alter table public.routines add column if not exists active boolean not null default true;
