import { getTableColumns, getTableName } from 'drizzle-orm';

import * as schema from '@/db/schema';

/**
 * Every table that syncs to the cloud (`supabase/migrations/20260925010000_sync_tables.sql`).
 * `calendarEvents` / `calendarAccounts` are deliberately not here — those already sync through
 * the `gcal` Edge Function, with Google (not this Postgres project) as their source of truth.
 */
export const SYNC_TABLES = [
  schema.areas,
  schema.contacts,
  schema.routines,
  schema.tasks,
  schema.notes,
  schema.wallets,
  schema.categories,
  schema.transactions,
  schema.recurringBills,
  schema.checkins,
  schema.focusSessions,
  schema.assistantMessages,
  schema.links,
] as const;

export type SyncTable = (typeof SYNC_TABLES)[number];

type ColumnMap = { jsToSql: Record<string, string>; sqlToJs: Record<string, string> };
const columnMapCache = new WeakMap<SyncTable, ColumnMap>();

/** JS property name ↔ SQL column name, read once per table from drizzle's own column metadata. */
function columnMap(table: SyncTable): ColumnMap {
  let map = columnMapCache.get(table);
  if (!map) {
    const jsToSql: Record<string, string> = {};
    const sqlToJs: Record<string, string> = {};
    for (const [jsKey, col] of Object.entries(getTableColumns(table))) {
      jsToSql[jsKey] = col.name;
      sqlToJs[col.name] = jsKey;
    }
    map = { jsToSql, sqlToJs };
    columnMapCache.set(table, map);
  }
  return map;
}

export const remoteName = (table: SyncTable): string => getTableName(table);

/** A local (drizzle select) row → an upsert payload for `supabase.from(remoteName(table))`. */
export function toRemote(table: SyncTable, row: Record<string, unknown>, userId: string): Record<string, unknown> {
  const { jsToSql } = columnMap(table);
  const out: Record<string, unknown> = { user_id: userId };
  for (const [jsKey, value] of Object.entries(row)) {
    // `syncedAt` is local-only bookkeeping; `userId` is set above, from the signed-in session.
    if (jsKey === 'syncedAt' || jsKey === 'userId') continue;
    out[jsToSql[jsKey] ?? jsKey] = value;
  }
  return out;
}

/** A Postgres row (snake_case) → values for `db.insert(table).values()` / `.onConflictDoUpdate()`. */
export function fromRemote(table: SyncTable, row: Record<string, unknown>): Record<string, unknown> {
  const { sqlToJs } = columnMap(table);
  const out: Record<string, unknown> = {};
  for (const [sqlKey, value] of Object.entries(row)) {
    const jsKey = sqlToJs[sqlKey];
    if (jsKey) out[jsKey] = value;
  }
  return out;
}
