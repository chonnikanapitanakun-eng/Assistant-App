import type { SQLiteBindValue, SQLiteDatabase } from 'expo-sqlite';

import { db, notifyDatabaseWrite, withSqlite } from '@/db/client';
import { seedIfEmpty } from '@/db/seed';
import { supabase } from '@/features/auth/client';
import { readJSON, removeKey, writeJSON } from '@/features/profile/storage';
import { now } from '@/lib/ids';

import { chunk, decide, incomingColumns, planSeedMerge, toRemote, type LocalRow } from './engine';
import { pullRows, pushRows, type PulledRow } from './remote';
import { LAST_SYNC_KEY, useSyncStatus } from './store';
import { syncTableByName, syncTables } from './tables';

const USER_KEY = 'sync:userId';
const cursorKey = (uid: string) => `sync:cursor:${uid}`;
const PAGE = 500;
const PUSH_CHUNK = 200;
const MIN_PULL_GAP_MS = 60_000;

let inFlight: Promise<void> | null = null;
let lastPull = 0;

/**
 * Pull what changed on the server, then push local changes (SPEC §6.5). Does nothing when the
 * project isn't configured or nobody is signed in. Never overlaps itself: a call made while a
 * sync is running goes after it. Pulls are throttled to once a minute unless `force`.
 * Rejects on failure (the status store keeps the message); callers decide whether to show it.
 */
export function syncNow({ pull = true, force = false } = {}): Promise<void> {
  if (!supabase()) return Promise.resolve();
  if (inFlight) return inFlight.then(() => syncNow({ pull, force }));
  const doPull = pull && (force || now() - lastPull >= MIN_PULL_GAP_MS);
  inFlight = run(doPull).finally(() => (inFlight = null));
  return inFlight;
}

async function run(doPull: boolean) {
  const client = supabase()!;
  const { data } = await client.auth.getSession();
  const uid = data.session?.user.id;
  if (!uid) return;

  useSyncStatus.setState({ busy: true });
  try {
    await adoptUser(uid);
    if (doPull) {
      await pull(uid);
      lastPull = now();
    }
    await push();
    const t = now();
    writeJSON(LAST_SYNC_KEY, t);
    useSyncStatus.setState({ busy: false, lastSyncedAt: t, error: null });
  } catch (e) {
    useSyncStatus.setState({ busy: false, error: e instanceof Error ? e.message : String(e) });
    throw e;
  }
}

const q = (name: string) => `"${name}"`;
const bindable = (v: unknown): SQLiteBindValue => (v == null ? null : typeof v === 'object' ? JSON.stringify(v) : (v as SQLiteBindValue));

/**
 * Rows made before signing in belong to whoever signs in. A *different* account than last time
 * replaces the data on this device with its own (the previous account's rows were synced to its
 * cloud copy; this device is now the new account's).
 */
async function adoptUser(uid: string) {
  const previous = readJSON<string>(USER_KEY);
  if (previous && previous !== uid) {
    await withSqlite(async (sqlite) => {
      await sqlite.withTransactionAsync(async () => {
        for (const t of syncTables) await sqlite.runAsync(`DELETE FROM ${q(t.name)}`);
      });
    });
    removeKey(cursorKey(previous));
    notifyDatabaseWrite();
    await seedIfEmpty(db);
  }
  writeJSON(USER_KEY, uid);
  await withSqlite(async (sqlite) => {
    for (const t of syncTables) await sqlite.runAsync(`UPDATE ${q(t.name)} SET user_id = ? WHERE user_id IS NULL`, [uid]);
  });
}

async function pull(uid: string) {
  let cursor = readJSON<number>(cursorKey(uid)) ?? 0;
  const firstRun = cursor === 0;
  for (;;) {
    const page = await pullRows(cursor, PAGE);
    if (!page.length) return;
    await applyPage(uid, page, firstRun);
    cursor = page[page.length - 1].server_seq;
    writeJSON(cursorKey(uid), cursor);
    if (page.length < PAGE) return;
  }
}

/** One transaction per page. A row that SQLite refuses (e.g. a constraint) is logged and skipped, not fatal. */
async function applyPage(uid: string, rows: PulledRow[], mergeSeeds: boolean) {
  let changed = false;
  await withSqlite(async (sqlite) => {
    await sqlite.withTransactionAsync(async () => {
      if (mergeSeeds) changed = (await mergeSeedRows(sqlite, rows)) || changed;
      for (const row of rows) {
        const spec = syncTableByName.get(row.table);
        if (!spec) continue; // a table this app version doesn't know
        const local = await sqlite.getFirstAsync<{ updated_at: number; synced_at: number | null }>(`SELECT updated_at, synced_at FROM ${q(spec.name)} WHERE id = ?`, [row.id]);
        if (decide(row, local ?? undefined) !== 'apply') continue;

        if (spec.unique) {
          // Another local row already holds this unique value (e.g. a check-in for the same day): newer wins.
          const other = await sqlite.getFirstAsync<{ id: string; updated_at: number }>(`SELECT id, updated_at FROM ${q(spec.name)} WHERE ${q(spec.unique)} = ? AND id <> ?`, [bindable(row.data[spec.unique]), row.id]);
          if (other) {
            if (other.updated_at > row.updated_at) continue;
            await sqlite.runAsync(`DELETE FROM ${q(spec.name)} WHERE id = ?`, [other.id]);
          }
        }

        const { columns, values } = incomingColumns(spec, row);
        const cols = [...columns, 'user_id', 'synced_at'];
        const vals = [...values, uid, row.updated_at].map(bindable);
        const sql = `INSERT INTO ${q(spec.name)} (${cols.map(q).join(', ')}) VALUES (${cols.map(() => '?').join(', ')}) ON CONFLICT(id) DO UPDATE SET ${cols
          .filter((c) => c !== 'id')
          .map((c) => `${q(c)} = excluded.${q(c)}`)
          .join(', ')}`;
        try {
          await sqlite.runAsync(sql, vals);
          changed = true;
        } catch (e) {
          console.warn(`sync: skipped ${spec.name}/${row.id}:`, e);
        }
      }
    });
  });
  if (changed) notifyDatabaseWrite();
}

/**
 * Each install seeds its own areas / categories / wallets with fresh ids. On the first pull, a
 * never-pushed local row that matches an incoming one by name is replaced by it, and every row
 * pointing at the old id is re-pointed (and marked changed, so it pushes with the shared id).
 */
async function mergeSeedRows(sqlite: SQLiteDatabase, rows: PulledRow[]): Promise<boolean> {
  let changed = false;
  const t = now();
  for (const spec of syncTables) {
    if (!spec.naturalKey || !rows.some((r) => r.table === spec.name)) continue;
    const local = await sqlite.getAllAsync<LocalRow>(`SELECT * FROM ${q(spec.name)} WHERE synced_at IS NULL AND deleted_at IS NULL`);
    for (const [localId, remoteId] of planSeedMerge(spec, local, rows)) {
      await sqlite.runAsync(`DELETE FROM ${q(spec.name)} WHERE id = ?`, [localId]);
      for (const ref of spec.referencedBy ?? []) {
        const guard = ref.when ? ` AND ${q(ref.when.column)} = ?` : '';
        await sqlite.runAsync(`UPDATE ${q(ref.table)} SET ${q(ref.column)} = ?, updated_at = ? WHERE ${q(ref.column)} = ?${guard}`, [remoteId, t, localId, ...(ref.when ? [ref.when.equals] : [])]);
      }
      changed = true;
    }
  }
  return changed;
}

/** Send every row changed since it was last synced, table by table, and mark it synced unless it changed meanwhile. */
async function push() {
  for (const spec of syncTables) {
    const dirty = await withSqlite((sqlite) => sqlite.getAllAsync<LocalRow>(`SELECT * FROM ${q(spec.name)} WHERE synced_at IS NULL OR updated_at > synced_at`));
    for (const batch of chunk(dirty, PUSH_CHUNK)) {
      await pushRows(batch.map((row) => toRemote(spec, row)));
      await withSqlite(async (sqlite) => {
        await sqlite.withTransactionAsync(async () => {
          for (const row of batch) await sqlite.runAsync(`UPDATE ${q(spec.name)} SET synced_at = ? WHERE id = ? AND updated_at = ?`, [row.updated_at, row.id, row.updated_at]);
        });
      });
    }
  }
}
