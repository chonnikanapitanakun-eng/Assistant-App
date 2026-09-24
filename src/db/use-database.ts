import { useEffect, useState } from 'react';

import { db, withSqlite } from './client';
import ftsSql from './fts.sql';
import { runMigrations } from './migrate';
import migrations from './migrations/migrations';
import { seedIfEmpty } from './seed';

/**
 * migrations → FTS → seed, once per app launch (memoised so dev re-renders / StrictMode
 * effects don't run it twice). FTS and seed are idempotent (IF NOT EXISTS / check before insert).
 */
let setup: Promise<void> | null = null;
function setupDatabase() {
  setup ??= (async () => {
    await withSqlite(async (sqlite) => {
      await runMigrations(sqlite, migrations);
      try {
        await sqlite.execAsync(ftsSql);
      } catch (e) {
        // expo-sqlite's web (wasm) build has no FTS5; native builds do. Skip only that case.
        // The first statement (CREATE VIRTUAL TABLE) is the one that fails, so no triggers are
        // created that would later break inserts. Search then finds nothing on web (see search/queries.ts).
        if (!String(e).includes('no such module: fts5')) throw e;
        console.warn('SQLite FTS5 is not available on this platform; universal search is disabled.');
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
