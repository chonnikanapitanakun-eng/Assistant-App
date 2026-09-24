import { useMigrations } from 'drizzle-orm/expo-sqlite/migrator';
import { useMemo } from 'react';

import { db, sqlite } from './client';
import ftsSql from './fts.sql';
import migrations from './migrations/migrations';
import { seedIfEmpty } from './seed';

/**
 * รัน migrations → FTS → seed ตอนเปิด app
 * FTS และ seed เป็น idempotent (IF NOT EXISTS / ตรวจก่อน insert) จึงรันซ้ำได้ปลอดภัย
 */
export function useDatabase() {
  const { success, error } = useMigrations(db, migrations);

  const setup = useMemo(() => {
    if (!success) return { ready: false, error: null as Error | null };
    try {
      sqlite.execSync(ftsSql);
      seedIfEmpty(db);
      return { ready: true, error: null as Error | null };
    } catch (e) {
      return { ready: false, error: e instanceof Error ? e : new Error(String(e)) };
    }
  }, [success]);

  return { ready: setup.ready, error: error ?? setup.error };
}
