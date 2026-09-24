import Storage from 'expo-sqlite/kv-store';

/** Tiny synchronous key-value wrapper (expo-sqlite kv-store). Never throws. */
export function readJSON<T>(key: string): T | null {
  try {
    const raw = Storage.getItemSync(key);
    return raw ? (JSON.parse(raw) as T) : null;
  } catch {
    return null;
  }
}

export function writeJSON(key: string, value: unknown) {
  try {
    Storage.setItemSync(key, JSON.stringify(value));
  } catch {
    // Non-fatal: the profile still lives in memory for this session.
  }
}
