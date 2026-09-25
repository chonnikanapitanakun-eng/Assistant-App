import type { BatchItem } from 'drizzle-orm/batch';
import { drizzle, type AsyncBatchRemoteCallback, type AsyncRemoteCallback } from 'drizzle-orm/sqlite-proxy';
import { openDatabaseAsync, type SQLiteBindValue, type SQLiteDatabase } from 'expo-sqlite';
import { Platform } from 'react-native';

import * as schema from './schema';

export const DB_NAME = 'proud-assistant.db';

/**
 * One async code path for native and web.
 *
 * drizzle-orm/expo-sqlite only uses expo-sqlite's *sync* API. On web that API blocks the main
 * thread while a worker answers, and it fails with "Sync operation timeout" (expo/expo#36392).
 * So drizzle talks to expo-sqlite's async API through drizzle-orm/sqlite-proxy instead.
 *
 * - The database opens lazily on first use; importing this module does nothing.
 * - Every statement goes through one serial queue. expo-sqlite's withTransactionAsync pulls any
 *   query that runs meanwhile into the open transaction, and withExclusiveTransactionAsync does
 *   not exist on web, so concurrent async statements could interleave.
 * - For atomic multi-statement writes use `db.batch([...])`: it runs as one transaction inside
 *   the queue. Do NOT use `db.transaction()` — sqlite-proxy sends BEGIN/COMMIT as separate queued
 *   statements, so other queries can land inside the transaction (and be rolled back with it).
 *   Do reads first, then batch the writes.
 */

// Best-effort: ask the browser not to evict this origin's storage under pressure (Safari on
// iOS is the aggressive one). Advisory only — the app works the same whether or not it's granted.
if (Platform.OS === 'web' && typeof navigator !== 'undefined' && navigator.storage?.persist) {
  navigator.storage.persist().catch(() => undefined);
}

let opening: Promise<SQLiteDatabase> | null = null;
const getSqlite = () => (opening ??= openDatabaseAsync(DB_NAME));

let tail: Promise<unknown> = Promise.resolve();
function serialize<T>(task: () => Promise<T>): Promise<T> {
  const result = tail.then(task);
  tail = result.catch(() => undefined);
  return result;
}

/**
 * Run raw work on the SQLiteDatabase in the same queue as drizzle (setup, migrations, FTS).
 * Never call `db` from inside `task`: it would wait behind this task forever.
 */
export function withSqlite<T>(task: (sqlite: SQLiteDatabase) => Promise<T>): Promise<T> {
  return serialize(async () => task(await getSqlite()));
}

type Method = Parameters<AsyncRemoteCallback>[2];

const isWrite = (sql: string) => !/^\s*(select|with|pragma)\b/i.test(sql);

async function execute(sqlite: SQLiteDatabase, sql: string, params: unknown[], method: Method) {
  const bind = params as SQLiteBindValue[];
  if (method === 'run') {
    await sqlite.runAsync(sql, bind);
    return { rows: [] };
  }
  // sqlite-proxy wants each row as an array in column order (not an object), so read raw rows.
  const stmt = await sqlite.prepareAsync(sql);
  try {
    const result = await stmt.executeForRawResultAsync(bind);
    if (method === 'get') {
      // For `get` the proxy expects the single row itself in `rows` (undefined when there is none).
      return { rows: ((await result.getFirstAsync()) ?? undefined) as unknown as unknown[] };
    }
    return { rows: await result.getAllAsync() };
  } finally {
    await stmt.finalizeAsync();
  }
}

// ── Write notifications (replace useLiveQuery's change listener; see query.ts) ──
const writeListeners = new Set<() => void>();
let notifyScheduled = false;
function notifyWrite() {
  if (notifyScheduled) return;
  notifyScheduled = true;
  queueMicrotask(() => {
    notifyScheduled = false;
    writeListeners.forEach((listener) => listener());
  });
}

/** Called (once per microtask burst) after any statement that may have changed data. */
export function onDatabaseWrite(listener: () => void): () => void {
  writeListeners.add(listener);
  return () => writeListeners.delete(listener);
}

const run: AsyncRemoteCallback = (sql, params, method) =>
  withSqlite(async (sqlite) => {
    const result = await execute(sqlite, sql, params, method);
    if (isWrite(sql)) notifyWrite();
    return result;
  });

const runBatch: AsyncBatchRemoteCallback = (queries) =>
  withSqlite(async (sqlite) => {
    const results: { rows: unknown[] }[] = [];
    await sqlite.withTransactionAsync(async () => {
      for (const q of queries) results.push(await execute(sqlite, q.sql, q.params, q.method));
    });
    if (queries.some((q) => isWrite(q.sql))) notifyWrite();
    return results;
  });

export const db = drizzle(run, runBatch, { schema });

export type Db = typeof db;

/** A drizzle write statement that has not run yet (insert / update / delete builder). */
export type Write = BatchItem<'sqlite'>;

/** Run writes atomically, as one transaction (`db.batch`). No-op for an empty list. */
export async function commit(writes: Write[], target: Db = db): Promise<void> {
  const [first, ...rest] = writes;
  if (first) await target.batch([first, ...rest]);
}
