import { useEffect, useState } from 'react';

import { db, withSqlite } from './client';
import ftsSql from './fts.sql';
import { runMigrations } from './migrate';
import migrations from './migrations/migrations';
import { seedIfEmpty } from './seed';

/**
 * migrations → FTS → seed ครั้งเดียวต่อการเปิด app (memo ไว้ กัน effect รันซ้ำใน dev/StrictMode)
 * FTS และ seed เป็น idempotent (IF NOT EXISTS / ตรวจก่อน insert)
 */
let setup: Promise<void> | null = null;
function setupDatabase() {
  setup ??= (async () => {
    await withSqlite(async (sqlite) => {
      await runMigrations(sqlite, migrations);
      try {
        await sqlite.execAsync(ftsSql);
      } catch (e) {
        // build wasm ของ expo-sqlite บน web ไม่มี FTS5 (native เปิดไว้ตามค่า default) → ข้ามไป
        // statement แรก (CREATE VIRTUAL TABLE) fail จึงไม่มี trigger ค้างที่จะทำให้ insert พัง
        // ฟีเจอร์ค้นหาในอนาคตต้องรองรับกรณีไม่มีตาราง fts_index
        if (!String(e).includes('no such module: fts5')) throw e;
        console.warn('SQLite FTS5 not available on this platform; full-text search index disabled.');
      }
    });
    await seedIfEmpty(db);
  })();
  return setup;
}

export function useDatabase() {
  const [state, setState] = useState<{ ready: boolean; error: Error | null }>({ ready: false, error: null });

  useEffect(() => {
    let active = true;
    setupDatabase().then(
      () => active && setState({ ready: true, error: null }),
      (e: unknown) => active && setState({ ready: false, error: e instanceof Error ? e : new Error(String(e)) }),
    );
    return () => {
      active = false;
    };
  }, []);

  return state;
}
