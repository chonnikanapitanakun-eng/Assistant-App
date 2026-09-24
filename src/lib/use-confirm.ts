import { useEffect, useRef, useState } from 'react';

/**
 * Two-tap confirmation for destructive actions (Alert.alert is a no-op on web).
 * First call arms it for `ms`; a second call within that window runs `action`.
 */
export function useConfirm(ms = 4000) {
  const [armed, setArmed] = useState(false);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => () => {
    if (timer.current) clearTimeout(timer.current);
  }, []);
  const confirm = (action: () => void) => {
    if (armed) {
      if (timer.current) clearTimeout(timer.current);
      setArmed(false);
      action();
      return;
    }
    setArmed(true);
    timer.current = setTimeout(() => setArmed(false), ms);
  };
  return { armed, confirm } as const;
}
