import { getTableColumns } from 'drizzle-orm';
import { getTableConfig, type SQLiteTable } from 'drizzle-orm/sqlite-core';

import * as schema from '@/db/schema';

/**
 * A table that syncs, described by its SQL names (the engine talks to SQLite directly, so the
 * payload keeps SQLite's column names and raw values — JSON columns stay strings, booleans 0/1).
 */
export type SyncTableSpec = {
  name: string;
  /** Every column, in schema order. Unknown keys in a pulled row are ignored. */
  columns: string[];
  /** Device-specific columns that never leave the device (scheduled notification ids). */
  localOnly: string[];
  /**
   * Columns that identify "the same" default row on two devices (each install seeds its own
   * areas / categories / wallets with fresh ids). On a device's first pull, an unsynced local row
   * whose key matches an incoming one is replaced by it and references are re-pointed.
   */
  naturalKey?: string[];
  /** A UNIQUE column other than id: an older local row holding the value gives way to the incoming one. */
  unique?: string;
  /** Columns in other tables that hold this table's ids (for the seed merge). */
  referencedBy?: { table: string; column: string; when?: { column: string; equals: string } }[];
};

/** Columns every table has that are bookkeeping, not content: never part of the payload. */
export const BOOKKEEPING = ['user_id', 'synced_at'];

const spec = (table: SQLiteTable, extra: Partial<Omit<SyncTableSpec, 'name' | 'columns'>> = {}): SyncTableSpec => ({
  name: getTableConfig(table).name,
  columns: Object.values(getTableColumns(table)).map((c) => c.name),
  localOnly: [],
  ...extra,
});

const areaRefs = ['contacts', 'routines', 'tasks', 'notes', 'transactions'].map((table) => ({ table, column: 'area_id' }));

/**
 * What syncs, in the order pulled rows are applied. Left out on purpose: calendar_events and
 * calendar_accounts (Google import is per device and re-imports itself, see google-calendar).
 */
export const syncTables: SyncTableSpec[] = [
  spec(schema.areas, {
    naturalKey: ['name_th', 'name_en'],
    referencedBy: [
      { table: 'areas', column: 'parent_id' },
      ...areaRefs,
      { table: 'links', column: 'from_id', when: { column: 'from_type', equals: 'area' } },
      { table: 'links', column: 'to_id', when: { column: 'to_type', equals: 'area' } },
    ],
  }),
  spec(schema.categories, {
    naturalKey: ['name_th', 'name_en', 'type'],
    referencedBy: [
      { table: 'transactions', column: 'category_id' },
      { table: 'recurring_bills', column: 'category_id' },
    ],
  }),
  spec(schema.wallets, {
    naturalKey: ['name', 'type', 'currency'],
    referencedBy: [
      { table: 'transactions', column: 'wallet_id' },
      { table: 'transactions', column: 'to_wallet_id' },
      { table: 'recurring_bills', column: 'wallet_id' },
    ],
  }),
  spec(schema.contacts),
  spec(schema.routines),
  spec(schema.tasks, { localOnly: ['reminder_notification_id'] }),
  spec(schema.notes),
  spec(schema.transactions),
  spec(schema.recurringBills, { localOnly: ['reminder_notification_id'] }),
  spec(schema.checkins, { unique: 'date' }),
  spec(schema.focusSessions),
  spec(schema.links),
  spec(schema.assistantMessages),
];

export const syncTableByName = new Map(syncTables.map((t) => [t.name, t]));
