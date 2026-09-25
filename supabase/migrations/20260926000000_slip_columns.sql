-- Slip OCR (P3-04): mirror the sqlite columns added in src/db/migrations/0006 so cloud sync
-- round-trips them (column names match the sqlite ones 1:1 — see 20260925010000_sync_tables.sql).
alter table public.wallets add column if not exists bank_code text;
alter table public.wallets add column if not exists account_digits text;
alter table public.transactions add column if not exists payee text;
alter table public.transactions add column if not exists slip_ref text;
