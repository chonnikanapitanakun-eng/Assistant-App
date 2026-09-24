import { useCallback, useEffect, useState } from 'react';
import { AppState } from 'react-native';

import { getPermissionState, requestPermission, type PermissionState } from './permissions';

/** สถานะ permission ปัจจุบัน + refresh อัตโนมัติเมื่อกลับมาที่ app (เผื่อ user ไปเปิดใน Settings) */
export function useNotificationPermission() {
  const [state, setState] = useState<PermissionState | null>(null);

  const refresh = useCallback(() => {
    void getPermissionState().then(setState);
  }, []);

  useEffect(() => {
    refresh();
    const sub = AppState.addEventListener('change', (next) => {
      if (next === 'active') refresh();
    });
    return () => sub.remove();
  }, [refresh]);

  const request = useCallback(async () => {
    const next = await requestPermission();
    setState(next);
    return next;
  }, []);

  return { state, request };
}
