import { useEffect, useState } from 'react';
import { Platform } from 'react-native';

import { db, isDatabaseLocked, withSqlite } from './client';
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

/**
 * Web: when the database is locked, expo-sqlite's worker keeps the half-opened handles and won't
 * retry, so reload the page (fresh worker) a few times, backing off. The page we just left usually
 * lets go within a second or two; if another tab really holds it, _layout.tsx says so.
 */
const RELOAD_KEY = 'db:lockReloads';
const RELOAD_DELAYS_MS = [300, 800, 1500, 3000];

function session(): Storage | null {
  try {
    return Platform.OS === 'web' ? window.sessionStorage : null;
  } catch {
    return null;
  }
}

/** True when a reload was scheduled (keep showing the spinner instead of the error). */
function reloadIfLocked(e: unknown): boolean {
  const store = session();
  if (!store || !isDatabaseLocked(e)) return false;
  const attempt = Number(store.getItem(RELOAD_KEY) ?? 0);
  if (attempt >= RELOAD_DELAYS_MS.length) {
    store.removeItem(RELOAD_KEY); // a manual reload later starts a fresh round
    return false;
  }
  store.setItem(RELOAD_KEY, String(attempt + 1));
  setTimeout(() => window.location.reload(), RELOAD_DELAYS_MS[attempt]);
  return true;
}

export function useDatabase() {
  const [state, setState] = useState<{ ready: boolean; error: Error | null }>({ ready: false, error: null });

  useEffect(() => {
    let active = true;
    setupDatabase().then(
      () => {
        session()?.removeItem(RELOAD_KEY);
        if (active) setState({ ready: true, error: null });
      },
      (e: unknown) => {
        if (reloadIfLocked(e)) return;
        if (active) setState({ ready: false, error: e instanceof Error ? e : new Error(String(e)) });
      },
    );
    return () => {
      active = false;
    };
  }, []);

  return state;
}
