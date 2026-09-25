import { useEffect } from 'react';
import { AppState } from 'react-native';

import { background } from '@/lib/background';

import { syncGoogleCalendars } from './sync';

/** Sync linked Google calendars when the app opens and each time it comes back to the foreground (throttled in sync.ts). */
export function GoogleCalendarAutoSync() {
  useEffect(() => {
    background(syncGoogleCalendars(), 'Google Calendar sync');
    const sub = AppState.addEventListener('change', (s) => {
      if (s === 'active') background(syncGoogleCalendars(), 'Google Calendar sync');
    });
    return () => sub.remove();
  }, []);
  return null;
}
