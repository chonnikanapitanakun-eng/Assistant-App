import { useEffect } from 'react';
import { AppState } from 'react-native';

import { clearProviderRefreshToken, useProviderRefreshToken, useSession } from '@/features/auth';
import { claimGoogleAccounts, linkFromSignIn } from '@/features/google-calendar';
import { background } from '@/lib/background';

import { runSync } from './engine';

/**
 * Runs a full sync the moment a session appears (app open while signed in, or right after
 * sign-in) and each time the app returns to the foreground. Per-write pushes are handled by
 * engine.ts's own db-write listener, not here.
 */
export function SyncAutoRun() {
  const session = useSession();
  const userId = session?.user.id;
  const refreshToken = useProviderRefreshToken();

  // Just signed in with Google (Calendar access asked on the same screen): link that calendar too.
  useEffect(() => {
    if (!session || !refreshToken) return;
    clearProviderRefreshToken();
    background(linkFromSignIn(session.access_token, refreshToken, session.user.email), 'Google Calendar link');
  }, [session, refreshToken]);

  useEffect(() => {
    if (!userId || !session) return;
    background(runSync(), 'Cloud sync');
    // Best-effort: attach this device's Google Calendar accounts (linked before sign-in) to the account.
    background(claimGoogleAccounts(session.access_token), 'Google Calendar claim');
    const sub = AppState.addEventListener('change', (s) => {
      if (s === 'active') background(runSync(), 'Cloud sync');
    });
    return () => sub.remove();
    // eslint-disable-next-line react-hooks/exhaustive-deps -- re-run only when the signed-in user changes
  }, [userId]);

  return null;
}
