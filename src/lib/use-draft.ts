import { useEffect, useState, type Dispatch, type SetStateAction } from 'react';

import { readJSON, removeKey, writeJSON } from '@/features/profile/storage';

/** Drafts older than this are ignored — the user has moved on. */
const MAX_AGE_MS = 24 * 60 * 60 * 1000;

type Stored<T> = { v: T; at: number };

/**
 * `useState` for unsaved form input that survives the page being killed.
 * Mobile browsers (iOS Safari especially) discard background tabs and reload them on return;
 * the draft is written to device storage on every change and restored on the next mount.
 * Leaving the screen in-app (save, cancel, back) unmounts it and clears the draft —
 * a killed page never unmounts, so only that case restores.
 * Pass `null` as the key to opt out (plain state).
 */
export function useDraft<T>(key: string | null, initial: T): [T, Dispatch<SetStateAction<T>>] {
  const storageKey = key && `draft:${key}`;
  const [value, setValue] = useState<T>(() => {
    const saved = storageKey ? readJSON<Stored<T>>(storageKey) : null;
    return saved && Date.now() - saved.at < MAX_AGE_MS ? saved.v : initial;
  });

  useEffect(() => {
    if (storageKey) writeJSON(storageKey, { v: value, at: Date.now() });
  }, [storageKey, value]);

  useEffect(() => (storageKey ? () => removeKey(storageKey) : undefined), [storageKey]);

  return [value, setValue];
}
