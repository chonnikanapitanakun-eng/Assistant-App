import { gt, inArray, isNull, or } from 'drizzle-orm';

import { commit, db } from '@/db';
import { supabase } from '@/lib/supabase';

import { remoteName, toRemote, type SyncTable } from './tables';

const PUSH_BATCH = 500;

/**
 * Push this table's dirty rows (never synced, or edited since the last sync) to Postgres.
 * Generic over every table in `SYNC_TABLES` via drizzle's column metadata (tables.ts), so the
 * table param's exact shape is dynamic — the `as never` casts below are that, not a type escape.
 */
export async function pushTable(table: SyncTable, userId: string): Promise<number> {
  if (!supabase) return 0;
  const dirty = await db
    .select()
    .from(table)
    .where(or(isNull(table.syncedAt), gt(table.updatedAt, table.syncedAt)))
    .limit(PUSH_BATCH)
    .all();
  if (!dirty.length) return 0;

  const pushedAt = Date.now();
  const payload = dirty.map((row) => toRemote(table, row as Record<string, unknown>, userId));
  const { error } = await supabase.from(remoteName(table)).upsert(payload, { onConflict: 'id' });
  if (error) throw error;

  const ids = dirty.map((row) => (row as { id: string }).id);
  await commit([db.update(table).set({ syncedAt: pushedAt } as never).where(inArray(table.id, ids))]);
  return dirty.length;
}
