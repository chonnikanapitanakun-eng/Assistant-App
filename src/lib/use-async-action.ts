import { useCallback, useRef, useState } from 'react';

/**
 * Run an async action from a button (save / delete): ignores repeat taps while it runs,
 * exposes `busy` to disable the button, and `failed` to show an error instead of failing silently.
 * `run` resolves true when the action succeeded.
 */
export function useAsyncAction() {
  const running = useRef(false);
  const [busy, setBusy] = useState(false);
  const [failed, setFailed] = useState(false);

  const run = useCallback(async (action: () => Promise<unknown>): Promise<boolean> => {
    if (running.current) return false;
    running.current = true;
    setBusy(true);
    setFailed(false);
    try {
      await action();
      return true;
    } catch (e) {
      console.error('Action failed:', e);
      setFailed(true);
      return false;
    } finally {
      running.current = false;
      setBusy(false);
    }
  }, []);

  return { busy, failed, run } as const;
}
