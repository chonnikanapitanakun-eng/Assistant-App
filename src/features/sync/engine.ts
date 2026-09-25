/**
 * Pure sync rules (SPEC §6.5), kept apart from SQLite / network so they can be unit-tested.
 *
 * - Push: rows with `updated_at > synced_at` (or never synced).
 * - Pull: rows with `server_seq > cursor`.
 * - Conflict: last-write-wins on `updated_at`; a tie is our own row echoed back.
 * - Delete: soft, via `deleted_at`, like the rest of the app.
 */
import { BOOKKEEPING, type SyncTableSpec } from './tables';

/** A local row as SQLite returns it (column names, raw values). */
export type LocalRow = Record<string, unknown> & { id: string; updated_at: number; synced_at: number | null; deleted_at: number | null };

/** What goes to / comes from `sync_rows`. */
export type RemoteRow = { table: string; id: string; data: Record<string, unknown>; updated_at: number; deleted_at: number | null };

export const isDirty = (row: { updated_at: number; synced_at: number | null }) => row.synced_at == null || row.updated_at > row.synced_at;

/** The payload for a local row: content columns only. */
export function toRemote(spec: SyncTableSpec, row: LocalRow): RemoteRow {
  const skip = new Set([...BOOKKEEPING, ...spec.localOnly]);
  const data: Record<string, unknown> = {};
  for (const col of spec.columns) if (!skip.has(col) && col in row) data[col] = row[col] ?? null;
  return { table: spec.name, id: row.id, data, updated_at: row.updated_at, deleted_at: row.deleted_at ?? null };
}

/** Columns of an incoming row this app version knows and is allowed to overwrite, plus their values. */
export function incomingColumns(spec: SyncTableSpec, incoming: RemoteRow): { columns: string[]; values: unknown[] } {
  const skip = new Set([...BOOKKEEPING, ...spec.localOnly]);
  const columns: string[] = [];
  const values: unknown[] = [];
  for (const col of spec.columns) {
    if (skip.has(col) || !(col in incoming.data)) continue;
    columns.push(col);
    values.push(incoming.data[col] ?? null);
  }
  // The envelope is authoritative for these two, whatever the payload says.
  for (const [col, value] of [
    ['updated_at', incoming.updated_at],
    ['deleted_at', incoming.deleted_at],
  ] as const) {
    const i = columns.indexOf(col);
    if (i >= 0) values[i] = value;
    else {
      columns.push(col);
      values.push(value);
    }
  }
  if (!columns.includes('id')) {
    columns.push('id');
    values.push(incoming.id);
  }
  return { columns, values };
}

export type Decision = 'apply' | 'keep_local' | 'echo';

/** Last-write-wins. `echo` = the same version we pushed, already marked synced: nothing to do. */
export function decide(incoming: RemoteRow, local: Pick<LocalRow, 'updated_at' | 'synced_at'> | undefined): Decision {
  if (!local) return 'apply';
  if (local.updated_at > incoming.updated_at) return 'keep_local';
  if (local.updated_at === incoming.updated_at && !isDirty(local)) return 'echo';
  return 'apply';
}

export const naturalKeyOf = (spec: SyncTableSpec, row: Record<string, unknown>) => spec.naturalKey!.map((c) => String(row[c] ?? '')).join('\u0000');

/**
 * First pull on a device: local default rows that were never pushed and match an incoming row by
 * natural key are dropped in favour of the incoming id. Returns local id → incoming id.
 */
export function planSeedMerge(spec: SyncTableSpec, unsyncedLocal: LocalRow[], incoming: RemoteRow[]): Map<string, string> {
  const map = new Map<string, string>();
  if (!spec.naturalKey) return map;
  const byKey = new Map<string, string>();
  for (const r of incoming) if (r.table === spec.name && r.deleted_at == null) byKey.set(naturalKeyOf(spec, r.data), r.id);
  for (const l of unsyncedLocal) {
    if (l.deleted_at != null || !isDirty(l) || l.synced_at != null) continue;
    const remoteId = byKey.get(naturalKeyOf(spec, l));
    if (remoteId && remoteId !== l.id) map.set(l.id, remoteId);
  }
  return map;
}

export function chunk<T>(items: T[], size: number): T[][] {
  const out: T[][] = [];
  for (let i = 0; i < items.length; i += size) out.push(items.slice(i, i + size));
  return out;
}
