import type { Profile } from '@/features/profile/store';

/** Bookkeeping that only means something to this install — not the user's data. */
const OMIT_COLUMNS = new Set(['syncedAt', 'userId', 'reminderNotificationId']);

export type DataExport = {
  app: 'Veyra';
  /** Bump when the shape changes. */
  format: 1;
  version: string;
  exportedAt: string;
  profile: Pick<Profile, 'name' | 'language' | 'currency' | 'interests' | 'fxRates'>;
  /** Keyed by SQL table name (`tasks`, `recurring_bills`, …); rows keep their JS property names. */
  tables: Record<string, Record<string, unknown>[]>;
};

/** Pure: shape the rows already read into the export document (tested). */
export function buildExport(tables: Record<string, Record<string, unknown>[]>, profile: Profile, version: string, exportedAt = new Date()): DataExport {
  const out: DataExport['tables'] = {};
  for (const [name, rows] of Object.entries(tables)) {
    out[name] = rows.map((row) => Object.fromEntries(Object.entries(row).filter(([key]) => !OMIT_COLUMNS.has(key))));
  }
  const { name, language, currency, interests, fxRates } = profile;
  return { app: 'Veyra', format: 1, version, exportedAt: exportedAt.toISOString(), profile: { name, language, currency, interests, fxRates }, tables: out };
}
