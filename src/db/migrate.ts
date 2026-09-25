import type { SQLiteDatabase } from 'expo-sqlite';

type MigrationBundle = {
  journal: { entries: { idx: number; when: number; tag: string }[] };
  migrations: Record<string, string>;
};

/**
 * Apply drizzle-kit migrations with expo-sqlite's async API.
 *
 * Mirrors drizzle-orm/expo-sqlite's `useMigrations` exactly: same `__drizzle_migrations` table,
 * hash = '' and created_at = the journal's `when`. Databases already migrated on a device by the
 * old sync driver are therefore recognised and not migrated again.
 * (drizzle-orm/sqlite-proxy/migrator reads .sql files with Node's fs, so it can't run in the app.)
 */
export async function runMigrations(sqlite: SQLiteDatabase, { journal, migrations }: MigrationBundle) {
  await sqlite.execAsync('CREATE TABLE IF NOT EXISTS "__drizzle_migrations" (id SERIAL PRIMARY KEY, hash text NOT NULL, created_at numeric)');
  const last = await sqlite.getFirstAsync<{ created_at: number | string }>('SELECT created_at FROM "__drizzle_migrations" ORDER BY created_at DESC LIMIT 1');
  const pending = journal.entries.filter((e) => !last || Number(last.created_at) < e.when);
  if (pending.length === 0) return;

  await sqlite.withTransactionAsync(async () => {
    for (const entry of pending) {
      const source = migrations[`m${entry.idx.toString().padStart(4, '0')}`];
      if (!source) throw new Error(`Missing migration: ${entry.tag}`);
      for (const statement of source.split('--> statement-breakpoint')) {
        if (statement.trim()) await sqlite.execAsync(statement);
      }
      await sqlite.runAsync('INSERT INTO "__drizzle_migrations" ("hash", "created_at") VALUES (?, ?)', ['', entry.when]);
    }
  });
}
