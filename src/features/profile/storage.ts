import Storage from 'expo-sqlite/kv-store';
import { Platform } from 'react-native';

/**
 * Tiny synchronous key-value store. Never throws.
 * Native: expo-sqlite kv-store. Web: localStorage — kv-store's sync API goes through
 * expo-sqlite's sync web path, which blocks the page and times out (expo/expo#36392).
 */
const store =
  Platform.OS === 'web'
    ? { get: (key: string) => window.localStorage.getItem(key), set: (key: string, value: string) => window.localStorage.setItem(key, value) }
    : { get: (key: string) => Storage.getItemSync(key), set: (key: string, value: string) => Storage.setItemSync(key, value) };

export function readJSON<T>(key: string): T | null {
  try {
    const raw = store.get(key);
    return raw ? (JSON.parse(raw) as T) : null;
  } catch {
    // Also covers server rendering on web, where there is no window.
    return null;
  }
}

export function writeJSON(key: string, value: unknown) {
  try {
    store.set(key, JSON.stringify(value));
  } catch {
    // Non-fatal: the profile still lives in memory for this session.
  }
}
