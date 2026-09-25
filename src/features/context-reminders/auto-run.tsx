import { useEffect } from 'react';
import { Platform } from 'react-native';

import { useProfile } from '@/features/profile/store';
import { background } from '@/lib/background';
import { useLiveRefresh } from '@/lib/use-live-refresh';

import { syncContextReminders } from './schedule';

/** Keeps context-aware reminders (P3-07) scheduled from the latest data. Mount once at the root. */
export function ContextReminderAutoRun() {
  if (Platform.OS === 'web') return null;
  return <Runner />;
}

function Runner() {
  useLiveRefresh(syncContextReminders, 'Context reminders');
  // The lead time lives in the profile, not the DB, so watch it separately.
  const lead = useProfile((p) => p.contextReminderMin);
  useEffect(() => {
    background(syncContextReminders(), 'Context reminders');
  }, [lead]);
  return null;
}
