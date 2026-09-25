import { create } from 'zustand';

import { hashPin, randomSalt } from './pin';
import { readSecureJSON, removeSecureKey, writeSecureJSON } from './storage';

const KEY = 'veyra.security';

type Saved = { pinHash: string; salt: string; biometricEnabled: boolean };

type Store = {
  pinHash: string | null;
  salt: string | null;
  biometricEnabled: boolean;
  /** In-memory only: the lock screen is showing. Starts locked whenever a PIN is already set. */
  locked: boolean;
  /** Hash and store a new PIN, turning app lock on (or changing it). */
  setPin: (pin: string) => Promise<void>;
  /** Check a PIN against the stored hash. */
  verifyPin: (pin: string) => Promise<boolean>;
  /** Turn app lock off entirely (Settings, or after "forgot PIN" has erased the device — see forgot-pin.ts). */
  disable: () => void;
  setBiometricEnabled: (on: boolean) => void;
  lock: () => void;
  unlock: () => void;
};

const saved = readSecureJSON<Saved>(KEY);

export const useSecurity = create<Store>((set, get) => ({
  pinHash: saved?.pinHash ?? null,
  salt: saved?.salt ?? null,
  biometricEnabled: saved?.biometricEnabled ?? false,
  locked: !!saved?.pinHash,
  setPin: async (pin) => {
    const salt = randomSalt();
    const pinHash = await hashPin(pin, salt);
    set({ pinHash, salt });
    writeSecureJSON(KEY, { pinHash, salt, biometricEnabled: get().biometricEnabled });
  },
  verifyPin: async (pin) => {
    const { pinHash, salt } = get();
    if (!pinHash || !salt) return false;
    return (await hashPin(pin, salt)) === pinHash;
  },
  disable: () => {
    removeSecureKey(KEY);
    set({ pinHash: null, salt: null, biometricEnabled: false, locked: false });
  },
  setBiometricEnabled: (biometricEnabled) => {
    set({ biometricEnabled });
    const { pinHash, salt } = get();
    if (pinHash && salt) writeSecureJSON(KEY, { pinHash, salt, biometricEnabled });
  },
  lock: () => {
    if (get().pinHash) set({ locked: true });
  },
  unlock: () => set({ locked: false }),
}));
