import { create } from 'zustand';

export const useSyncStatus = create<{ busy: boolean; lastSyncedAt: number | null; error: string | null }>(() => ({
  busy: false,
  lastSyncedAt: null,
  error: null,
}));
