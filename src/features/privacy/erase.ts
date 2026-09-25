import * as Notifications from 'expo-notifications';
import { Platform } from 'react-native';

import { calendarAccounts, commit, db } from '@/db';
import { seedIfEmpty } from '@/db/seed';
import { signOut } from '@/features/auth';
import { clearCalendarSyncState, disconnectGoogle, forgetDeviceKey } from '@/features/google-calendar';
import { removeKey } from '@/features/profile/storage';
import { defaultProfile, PROFILE_KEY, useProfile } from '@/features/profile/store';
import { clearPullCursors, useSyncStatus } from '@/features/sync';

import { EXPORT_TABLES } from './export';

/**
 * PDPA erasure on this device: sign out (so nothing below is pushed to the cloud), drop every
 * row and every kv-store key, cancel scheduled reminders, then put the default areas / categories
 * / wallet back so the app is usable, and send the user through onboarding again.
 *
 * Cloud data is untouched — that is `deleteAccount` (account.ts). Signing out first matters:
 * the sync engine pushes on every write, and a hard delete here must not reach Postgres as
 * anything (it wouldn't: pushed rows are soft-deleted, but the session being gone makes it certain).
 */
export async function eraseLocalData({ local = false } = {}): Promise<void> {
  await signOut({ local });
  await unlinkGoogleCalendars();
  if (Platform.OS !== 'web') await Notifications.cancelAllScheduledNotificationsAsync().catch(() => undefined);

  await commit(EXPORT_TABLES.map((table) => db.delete(table)));

  clearPullCursors();
  clearCalendarSyncState();
  forgetDeviceKey();
  removeKey(PROFILE_KEY);
  useProfile.setState(defaultProfile());
  useSyncStatus.setState({ busy: false, lastSyncedAt: null, error: null });

  await seedIfEmpty(db);
}

/**
 * Revoke each linked Google account's token at the server before its local row goes — otherwise
 * an account this device linked but never claimed (signed-out use) would stay on the server,
 * keyed by a device key we are about to forget. Best effort: offline, the rows are still erased.
 */
async function unlinkGoogleCalendars() {
  const accounts = await db.select({ id: calendarAccounts.id }).from(calendarAccounts).all();
  for (const { id } of accounts) await disconnectGoogle(id).catch((e: unknown) => console.warn('Could not unlink Google Calendar:', e));
}
