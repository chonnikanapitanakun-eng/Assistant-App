import { useEffect } from 'react';
import { AppState } from 'react-native';

import { onDatabaseWrite } from '@/db/client';
import { startAuth, useAuth } from '@/features/auth/store';
import { background } from '@/lib/background';

import { syncNow } from './sync';

const PUSH_DEBOUNCE_MS = 2_500;

/**
 * Keeps the session alive and, while signed in, syncs: on sign-in / app open, each time the app
 * returns to the foreground (pull throttled in sync.ts), and a couple of seconds after any local
 * write (push only — a pull's own writes therefore cost nothing).
 */
export function CloudSync() {
  const status = useAuth((s) => s.status);

  useEffect(() => {
    startAuth();
  }, []);

  useEffect(() => {
    if (status !== 'signed_in') return;
    background(syncNow({ force: true }), 'Cloud sync');
    const app = AppState.addEventListener('change', (s) => {
      if (s === 'active') background(syncNow(), 'Cloud sync');
    });
    let timer: ReturnType<typeof setTimeout> | undefined;
    const stop = onDatabaseWrite(() => {
      clearTimeout(timer);
      timer = setTimeout(() => background(syncNow({ pull: false }), 'Cloud push'), PUSH_DEBOUNCE_MS);
    });
    return () => {
      app.remove();
      stop();
      clearTimeout(timer);
    };
  }, [status]);

  return null;
}
