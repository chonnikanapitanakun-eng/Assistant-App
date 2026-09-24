import { drizzle, type AsyncBatchRemoteCallback, type AsyncRemoteCallback } from 'drizzle-orm/sqlite-proxy';
import { openDatabaseAsync, type SQLiteBindValue, type SQLiteDatabase } from 'expo-sqlite';

import * as schema from './schema';

export const DB_NAME = 'proud-assistant.db';

/**
 * ใช้ expo-sqlite แบบ async เท่านั้น ทั้ง native และ web (code path เดียว)
 * — sync API บน web ใช้ Atomics.wait บล็อก main thread แล้ว timeout (expo/expo#36392)
 * drizzle ต่อผ่าน sqlite-proxy: เราส่ง SQL + params ให้ expo-sqlite เอง
 *
 * ทุก statement วิ่งผ่านคิวเดียว (serialize) เพราะ withTransactionAsync ของ expo-sqlite
 * จะดึง query อื่นที่รันพร้อมกันเข้า transaction ด้วย และ withExclusiveTransactionAsync ใช้บน web ไม่ได้
 * → งานที่ต้อง atomic ให้ใช้ db.batch([...]) (รันใน transaction เดียวภายในคิว) ห้ามใช้ db.transaction()
 */

let opening: Promise<SQLiteDatabase> | null = null;
const getSqlite = () => (opening ??= openDatabaseAsync(DB_NAME));

let tail: Promise<unknown> = Promise.resolve();
function serialize<T>(task: () => Promise<T>): Promise<T> {
  const result = tail.then(task);
  tail = result.catch(() => undefined);
  return result;
}

/** รันงานกับ SQLiteDatabase ตรงๆ ภายในคิวเดียวกับ drizzle (ใช้ตอน migrate/setup) */
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
  // sqlite-proxy ต้องการแถวเป็น array ตามลำดับคอลัมน์ (ไม่ใช่ object) → ใช้ raw result
  const stmt = await sqlite.prepareAsync(sql);
  try {
    const result = await stmt.executeForRawResultAsync(bind);
    if (method === 'get') {
      // proxy รับแถวเดียวใน rows ตรงๆ; ไม่มีแถว = undefined
      return { rows: ((await result.getFirstAsync()) ?? undefined) as unknown as unknown[] };
    }
    return { rows: await result.getAllAsync() };
  } finally {
    await stmt.finalizeAsync();
  }
}

// ---- แจ้งเตือนเมื่อมีการเขียน DB (ให้ query cache refetch แทน useLiveQuery เดิม) ----
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
