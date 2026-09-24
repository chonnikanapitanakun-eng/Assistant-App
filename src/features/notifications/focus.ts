import * as Notifications from 'expo-notifications';
import { Platform } from 'react-native';

import { ensurePermission } from './permissions';
import { REMINDER_CHANNEL_ID } from './setup';

/** Schedule the "time's up" alert for a focus/break timer. Returns the id, or null if not possible. */
export async function scheduleTimerEnd(at: number, title: string, body: string): Promise<string | null> {
  if (Platform.OS === 'web' || at <= Date.now()) return null;
  if ((await ensurePermission()) !== 'granted') return null;
  return Notifications.scheduleNotificationAsync({
    content: { title, body, sound: true },
    trigger: { type: Notifications.SchedulableTriggerInputTypes.DATE, date: at, channelId: REMINDER_CHANNEL_ID },
  }).catch(() => null);
}

export async function cancelTimerEnd(id: string | null) {
  if (!id || Platform.OS === 'web') return;
  await Notifications.cancelScheduledNotificationAsync(id).catch(() => undefined);
}
