import { lt } from 'drizzle-orm';

import { commit, db } from '@/db';
import { readJSON, writeJSON } from '@/features/profile/storage';
import { supabase } from '@/lib/supabase';

import { fromRemote, remoteName, type SyncTable } from './tables';

const PULL_PAGE = 500;
const cursorKey = (table: SyncTable) => `sync:cursor:${remoteName(table)}`;

type RemoteRow = Record<string, unknown> & { updated_at: number };

/**
 * Pull this table's rows changed since the last pull (a per-table `updated_at` cursor, kept in
 * kv-store), upsert locally. Last-write-wins by `updatedAt`: the conflict update only applies
 * when the incoming row is newer than what's already local, so a not-yet-pushed local edit (this
 * runs right after `pushTable`, but a write can still land in between) is never overwritten by a
 * stale pull.
 */
export async function pullTable(table: SyncTable, userId: string): Promise<number> {
  if (!supabase) return 0;
  let cursor = readJSON<number>(cursorKey(table)) ?? 0;
  let total = 0;

  for (;;) {
    const { data, error } = await supabase
      .from(remoteName(table))
      .select('*')
      .eq('user_id', userId)
      .gt('updated_at', cursor)
      .order('updated_at', { ascending: true })
      .limit(PULL_PAGE);
    if (error) throw error;
    const rows = (data ?? []) as RemoteRow[];
    if (!rows.length) break;

    const writes = rows.map((remoteRow) => {
      const values = { ...fromRemote(table, remoteRow), syncedAt: remoteRow.updated_at } as never;
      return db.insert(table).values(values).onConflictDoUpdate({ target: table.id, set: values, where: lt(table.updatedAt, remoteRow.updated_at) });
    });
    await commit(writes);

    total += rows.length;
    cursor = rows[rows.length - 1].updated_at;
    writeJSON(cursorKey(table), cursor);
    if (rows.length < PULL_PAGE) break;
  }
  return total;
}
