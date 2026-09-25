import { eq } from 'drizzle-orm';
import * as Notifications from 'expo-notifications';
import { Platform } from 'react-native';

import { db, recurringBills } from '@/db';
import i18n from '@/i18n';

import { ensurePermission } from './permissions';
import { REMINDER_CHANNEL_ID } from './setup';

export type ReminderBill = { id: string; name: string; remindAt: number | null; reminderNotificationId: string | null };

export async function cancelBillReminder(notificationId: string | null) {
  if (!notificationId) return;
  await Notifications.cancelScheduledNotificationAsync(notificationId).catch(() => undefined);
}

/**
 * Keeps a bill's "due soon" notification in sync with its current `remindAt`:
 * cancels the old one (if any) → requests permission if not asked yet → schedules a new
 * one if `remindAt` is still in the future → saves the id to the DB.
 */
export async function syncBillReminder(bill: ReminderBill): Promise<void> {
  if (Platform.OS === 'web') return;
  await cancelBillReminder(bill.reminderNotificationId);

  let notificationId: string | null = null;
  if (bill.remindAt && bill.remindAt > Date.now()) {
    const permission = await ensurePermission();
    if (permission === 'granted') {
      notificationId = await Notifications.scheduleNotificationAsync({
        content: { title: i18n.t('money.bill_reminder_title', { name: bill.name }), body: i18n.t('money.bill_reminder_body'), sound: true },
        trigger: { type: Notifications.SchedulableTriggerInputTypes.DATE, date: bill.remindAt, channelId: REMINDER_CHANNEL_ID },
      }).catch(() => null);
    }
  }

  if (notificationId !== bill.reminderNotificationId) {
    await db.update(recurringBills).set({ reminderNotificationId: notificationId }).where(eq(recurringBills.id, bill.id));
  }
}
