import { eraseLocalData } from '@/features/privacy/erase';

import { useSecurity } from './store';

/**
 * "Forgot PIN" on the lock screen. Without the PIN nobody may read this device's data, so the only
 * way past the lock is the same erase as Settings → Privacy → "Erase this device" (privacy/erase.ts):
 * sign out, delete every local row and kv-store key, cancel reminders, re-seed defaults. Data that was
 * synced comes back by signing in again; anything never synced is gone.
 *
 * The PIN and lock setting are cleared only once the erase has succeeded — if it fails, whatever is
 * still on the device stays behind the lock. (`eraseLocalData` also clears them itself; clearing here
 * too keeps this guarantee independent of that function's internals.)
 */
export async function eraseForForgottenPin(erase: () => Promise<void> = eraseLocalData): Promise<void> {
  await erase();
  useSecurity.getState().disable();
}
