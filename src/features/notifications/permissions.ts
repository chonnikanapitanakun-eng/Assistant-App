import * as Notifications from 'expo-notifications';

export type PermissionState = 'granted' | 'denied' | 'undetermined';

function toState(status: Notifications.NotificationPermissionsStatus): PermissionState {
  if (status.granted) return 'granted';
  return status.canAskAgain ? 'undetermined' : 'denied';
}

/** ตรวจสถานะ permission ปัจจุบัน ไม่มีผลกับ user */
export async function getPermissionState(): Promise<PermissionState> {
  const status = await Notifications.getPermissionsAsync();
  return toState(status);
}

/** ขอ permission จาก user (แสดง system prompt ได้แค่ครั้งเดียวต่อ install บน iOS) */
export async function requestPermission(): Promise<PermissionState> {
  const status = await Notifications.requestPermissionsAsync({
    ios: { allowAlert: true, allowBadge: true, allowSound: true },
  });
  return toState(status);
}

/** เรียกก่อน schedule ทุกครั้ง: ใช้ค่าเดิมถ้ามีอยู่แล้ว, ขอใหม่ถ้ายังไม่เคยถาม, ไม่ re-prompt ถ้าเคยปฏิเสธ */
export async function ensurePermission(): Promise<PermissionState> {
  const current = await getPermissionState();
  if (current !== 'undetermined') return current;
  return requestPermission();
}
