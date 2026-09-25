import { getRandomBytes } from 'expo-crypto';

import { readJSON, writeJSON } from '@/features/profile/storage';

const KEY = 'gcal:deviceKey';

/**
 * Random secret that owns this device's linked Google accounts on the server (which stores only
 * its SHA-256). Until Supabase Auth ships, losing it (app reinstall, cleared site data) means
 * linking the accounts again.
 */
export function deviceKey(): string {
  const existing = readJSON<string>(KEY);
  if (existing && /^[0-9a-f]{64}$/.test(existing)) return existing;
  const key = Array.from(getRandomBytes(32), (b) => b.toString(16).padStart(2, '0')).join('');
  writeJSON(KEY, key);
  return key;
}
