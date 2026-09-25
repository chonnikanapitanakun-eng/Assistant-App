import * as SecureStore from 'expo-secure-store';
import { Platform } from 'react-native';

import { readJSON, removeKey, writeJSON } from '@/features/profile/storage';

/**
 * Synchronous key-value storage for the PIN hash and lock settings, backed by the OS
 * keychain/keystore. Web has no such API, so it falls back to the same storage profile
 * settings use there — acceptable since a web PIN only guards a device-local session.
 */
const useFallback = Platform.OS === 'web';

export function readSecureJSON<T>(key: string): T | null {
  if (useFallback) return readJSON<T>(key);
  try {
    const raw = SecureStore.getItem(key);
    return raw ? (JSON.parse(raw) as T) : null;
  } catch {
    return null;
  }
}

export function writeSecureJSON(key: string, value: unknown) {
  if (useFallback) return writeJSON(key, value);
  try {
    SecureStore.setItem(key, JSON.stringify(value));
  } catch {
    // Non-fatal: the setting still lives in memory for this session.
  }
}

export function removeSecureKey(key: string) {
  if (useFallback) return removeKey(key);
  try {
    SecureStore.deleteItemAsync(key).catch(() => {});
  } catch {
    // Non-fatal.
  }
}
