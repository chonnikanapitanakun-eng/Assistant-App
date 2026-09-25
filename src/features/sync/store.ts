import { create } from 'zustand';

import { readJSON } from '@/features/profile/storage';

export const LAST_SYNC_KEY = 'sync:lastSync';

/** Sync progress for the UI. `error` is the last failure's message (cleared by the next success). */
export const useSyncStatus = create<{ busy: boolean; lastSyncedAt: number | null; error: string | null }>(() => ({
  busy: false,
  lastSyncedAt: readJSON<number>(LAST_SYNC_KEY),
  error: null,
}));
