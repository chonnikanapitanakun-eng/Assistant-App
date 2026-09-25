import * as Notifications from 'expo-notifications';
import { Platform } from 'react-native';

export const REMINDER_CHANNEL_ID = 'reminders';
export const BRIEFING_CHANNEL_ID = 'briefing';

/** เรียกครั้งเดียวตอน app start: กำหนดว่า notification ที่มาตอนเปิด app อยู่ ให้แสดงยังไง */
export function configureNotificationHandler() {
  Notifications.setNotificationHandler({
    handleNotification: async () => ({
      shouldShowBanner: true,
      shouldShowList: true,
      shouldPlaySound: true,
      shouldSetBadge: false,
    }),
  });
}

/** Android ต้องมี channel ก่อนถึง schedule notification ได้ (ไม่มีผลบน iOS) */
export async function configureAndroidChannel() {
  if (Platform.OS !== 'android') return;
  await Notifications.setNotificationChannelAsync(REMINDER_CHANNEL_ID, {
    name: 'Reminders',
    importance: Notifications.AndroidImportance.HIGH,
    vibrationPattern: [0, 250, 250, 250],
  });
  // The morning briefing is informational: shows in the shade without buzzing.
  await Notifications.setNotificationChannelAsync(BRIEFING_CHANNEL_ID, {
    name: 'Morning briefing',
    importance: Notifications.AndroidImportance.DEFAULT,
  });
}
