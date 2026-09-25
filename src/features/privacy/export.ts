import Constants from 'expo-constants';
import { File, Paths } from 'expo-file-system';
import * as Sharing from 'expo-sharing';
import { getTableName } from 'drizzle-orm';
import { Platform } from 'react-native';

import { db } from '@/db';
import * as schema from '@/db/schema';
import { useProfile } from '@/features/profile/store';

import { buildExport } from './model';

/**
 * Every table the app stores. The device holds a superset of the cloud (calendar events and
 * accounts never sync), so the export reads locally and needs no server round trip.
 */
export const EXPORT_TABLES = [
  schema.areas,
  schema.contacts,
  schema.routines,
  schema.tasks,
  schema.notes,
  schema.wallets,
  schema.categories,
  schema.transactions,
  schema.recurringBills,
  schema.checkins,
  schema.focusSessions,
  schema.calendarEvents,
  schema.calendarAccounts,
  schema.assistantMessages,
  schema.links,
] as const;

async function readAll(): Promise<Record<string, Record<string, unknown>[]>> {
  const tables: Record<string, Record<string, unknown>[]> = {};
  for (const table of EXPORT_TABLES) tables[getTableName(table)] = (await db.select().from(table).all()) as Record<string, unknown>[];
  return tables;
}

const fileName = (d: Date) => `veyra-export-${d.toISOString().slice(0, 10)}.json`;

/**
 * PDPA right of access / data portability: everything on this device as one JSON file.
 * Web: a download. Native: the share sheet (Files, AirDrop, mail…). Throws on failure.
 */
export async function exportAllData(): Promise<void> {
  const exportedAt = new Date();
  const { update: _u, ...profile } = useProfile.getState();
  const doc = buildExport(await readAll(), profile, Constants.expoConfig?.version ?? '0', exportedAt);
  const text = JSON.stringify(doc, null, 2);

  if (Platform.OS === 'web') {
    const url = URL.createObjectURL(new Blob([text], { type: 'application/json' }));
    const a = document.createElement('a');
    a.href = url;
    a.download = fileName(exportedAt);
    a.click();
    setTimeout(() => URL.revokeObjectURL(url), 10_000);
    return;
  }

  const file = new File(Paths.cache, fileName(exportedAt));
  if (file.exists) file.delete();
  file.create();
  file.write(text);
  try {
    await Sharing.shareAsync(file.uri, { mimeType: 'application/json', UTI: 'public.json', dialogTitle: fileName(exportedAt) });
  } finally {
    // The share target has its own copy by now; don't leave personal data in the cache.
    if (file.exists) file.delete();
  }
}
