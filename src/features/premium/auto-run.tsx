import { useEffect } from 'react';
import { AppState } from 'react-native';

import { useAuthReady, useSession } from '@/features/auth';
import { background } from '@/lib/background';

import { identifyPurchases, resetPurchases } from './purchases';
import { loadServerStatus } from './remote';
import { forUser } from './store';

/** Keeps Veyra Pro status current: on sign-in / sign-out and each time the app returns to the foreground. */
export function PremiumAutoRun() {
  const session = useSession();
  const ready = useAuthReady();
  const userId = session?.user.id ?? null;

  useEffect(() => {
    if (!ready) return; // stored session still loading — keep the cached status meanwhile
    forUser(userId);
    if (!userId) {
      background(resetPurchases(), 'RevenueCat log out');
      return;
    }
    background(identifyPurchases(userId), 'RevenueCat identify');
    background(loadServerStatus(), 'Premium status');
    const sub = AppState.addEventListener('change', (s) => {
      if (s === 'active') background(loadServerStatus(), 'Premium status');
    });
    return () => sub.remove();
  }, [ready, userId]);

  return null;
}
