import { onDatabaseWrite } from '@/db';
import { getSession } from '@/features/auth';
import { getPro } from '@/features/premium/store';

import { pullTable } from './pull';
import { pushTable } from './push';
import { useSyncStatus } from './status';
import { SYNC_TABLES } from './tables';

let running: Promise<void> | null = null;

async function cycle(pull: boolean) {
  const userId = getSession()?.user.id;
  // Cloud sync is Veyra Pro (P4-06) — the insert/update RLS policies refuse it otherwise.
  if (!userId || !getPro()) return;
  useSyncStatus.setState({ busy: true, error: null });
  try {
    for (const table of SYNC_TABLES) await pushTable(table, userId);
    if (pull) for (const table of SYNC_TABLES) await pullTable(table, userId);
    useSyncStatus.setState({ busy: false, lastSyncedAt: Date.now() });
  } catch (e) {
    console.error('Cloud sync failed:', e);
    useSyncStatus.setState({ busy: false, error: e instanceof Error ? e.message : 'failed' });
  }
}

/** Push every table, then (unless `pull: false`) pull every table. Never overlaps a run in flight. */
export function runSync({ pull = true } = {}): Promise<void> {
  return (running ??= cycle(pull).finally(() => (running = null)));
}

// Push-only, debounced — keeps the cloud close to current without a poll, by riding the same
// write-notification hook `db/query.ts` uses to invalidate reads (db/client.ts).
let pushTimer: ReturnType<typeof setTimeout> | undefined;
const PUSH_DEBOUNCE_MS = 2000;

onDatabaseWrite(() => {
  if (!getSession() || !getPro()) return;
  clearTimeout(pushTimer);
  pushTimer = setTimeout(() => void runSync({ pull: false }), PUSH_DEBOUNCE_MS);
});
