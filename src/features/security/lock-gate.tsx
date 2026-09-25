import { useEffect } from 'react';
import { AppState, BackHandler, View } from 'react-native';

import { LockScreen } from './components/lock-screen';
import { useSecurity } from './store';

/**
 * Full-screen overlay mounted once at the app root. Re-locks whenever the app is backgrounded
 * (if a PIN is set) and blocks Android's back button while locked — the only way out is a
 * correct PIN, Face ID/Touch ID, or "forgot PIN" (which turns app lock off).
 */
export function LockGate() {
  const enabled = useSecurity((s) => s.pinHash !== null);
  const locked = useSecurity((s) => s.locked);
  const lock = useSecurity((s) => s.lock);

  useEffect(() => {
    const sub = AppState.addEventListener('change', (state) => {
      if (state === 'background') lock();
    });
    return () => sub.remove();
  }, [lock]);

  useEffect(() => {
    if (!locked) return;
    const sub = BackHandler.addEventListener('hardwareBackPress', () => true);
    return () => sub.remove();
  }, [locked]);

  if (!enabled || !locked) return null;
  return (
    <View style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0 }}>
      <LockScreen />
    </View>
  );
}
