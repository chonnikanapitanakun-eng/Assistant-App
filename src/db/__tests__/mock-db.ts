/**
 * A `@/db` stand-in for tests: same schema and drizzle query API, backed by Node's built-in
 * `node:sqlite` (in-memory) instead of expo-sqlite, so queries/save logic can run under Vitest
 * without a device. Real migrations + FTS are applied, so this is the same schema the app ships.
 *
 * Usage: `vi.mock('@/db', () => import('@/db/__tests__/mock-db'))`, then `resetDb()` in
 * `beforeEach` for a clean slate between tests.
 */
import fs from 'node:fs';
import { DatabaseSync } from 'node:sqlite';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import type { BatchItem } from 'drizzle-orm/batch';
import { drizzle, type AsyncBatchRemoteCallback, type AsyncRemoteCallback } from 'drizzle-orm/sqlite-proxy';

import * as schema from '../schema';

export * from '../schema';

const DB_DIR = path.dirname(fileURLToPath(import.meta.url)).replace(/__tests__$/, '');

function applyMigrations(sqlite: DatabaseSync) {
  const journal = JSON.parse(fs.readFileSync(path.join(DB_DIR, 'migrations', 'meta', '_journal.json'), 'utf-8')) as {
    entries: { idx: number; tag: string }[];
  };
  for (const entry of journal.entries) {
    const sql = fs.readFileSync(path.join(DB_DIR, 'migrations', `${entry.tag}.sql`), 'utf-8');
    for (const statement of sql.split('--> statement-breakpoint')) {
      const trimmed = statement.trim();
      if (trimmed) sqlite.exec(trimmed);
    }
  }
  // Best-effort, mirroring use-database.ts: harmless if this build of sqlite lacks FTS5.
  try {
    sqlite.exec(fs.readFileSync(path.join(DB_DIR, 'fts.sql'), 'utf-8'));
  } catch {
    /* search queries.ts already handles a missing fts_index the same way */
  }
}

function createSqlite(): DatabaseSync {
  const sqlite = new DatabaseSync(':memory:');
  applyMigrations(sqlite);
  return sqlite;
}

let sqlite = createSqlite();

/** Fresh in-memory schema for the next test. Call from `beforeEach`. */
export function resetDb() {
  sqlite = createSqlite();
}

type Method = 'run' | 'all' | 'values' | 'get';

function execute(sql: string, params: unknown[], method: Method) {
  const stmt = sqlite.prepare(sql);
  stmt.setReturnArrays(true);
  const bind = params as never[];
  if (method === 'run') {
    stmt.run(...bind);
    return { rows: [] };
  }
  if (method === 'get') {
    return { rows: (stmt.get(...bind) ?? undefined) as unknown as unknown[] };
  }
  return { rows: stmt.all(...bind) };
}

const run: AsyncRemoteCallback = async (sql, params, method) => execute(sql, params, method as Method);

const runBatch: AsyncBatchRemoteCallback = async (queries) => {
  const results: { rows: unknown[] }[] = [];
  sqlite.exec('BEGIN');
  try {
    for (const q of queries) results.push(execute(q.sql, q.params, q.method as Method));
    sqlite.exec('COMMIT');
  } catch (e) {
    sqlite.exec('ROLLBACK');
    throw e;
  }
  return results;
};

export const db = drizzle(run, runBatch, { schema });

export type Db = typeof db;

/** A drizzle write statement that has not run yet (insert / update / delete builder). */
export type Write = BatchItem<'sqlite'>;

/** Run writes atomically, as one transaction (`db.batch`). No-op for an empty list. */
export async function commit(writes: Write[], target: Db = db): Promise<void> {
  const [first, ...rest] = writes;
  if (first) await target.batch([first, ...rest]);
}

/** Minimal stand-in for expo-sqlite's async handle — enough for `getAllAsync` (search/queries.ts). */
export function withSqlite<T>(task: (sqlite: { getAllAsync<Row>(sql: string, params?: unknown[]): Promise<Row[]> }) => T | Promise<T>): Promise<T> {
  return Promise.resolve(
    task({
      getAllAsync: async <Row>(sql: string, params: unknown[] = []) => {
        const stmt = sqlite.prepare(sql);
        return stmt.all(...(params as never[])) as Row[];
      },
    }),
  );
}

export function useRows(): never {
  throw new Error('useRows() needs a React renderer — test the underlying query function instead.');
}
export function useDbQuery(): never {
  throw new Error('useDbQuery() needs a React renderer — test the underlying query function instead.');
}
