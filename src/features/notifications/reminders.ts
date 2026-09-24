import { eq } from 'drizzle-orm';
import * as Notifications from 'expo-notifications';

import { db, tasks } from '@/db';

import { ensurePermission } from './permissions';
import { REMINDER_CHANNEL_ID } from './setup';

export type ReminderTask = { id: string; title: string; reminderAt: number | null; reminderNotificationId: string | null };

/** ยกเลิก notification ที่ schedule ไว้ ถ้ามี — เรียกก่อน reschedule หรือตอนลบ/ปิดงานเสร็จเสมอ */
export async function cancelTaskReminder(notificationId: string | null) {
  if (!notificationId) return;
  await Notifications.cancelScheduledNotificationAsync(notificationId).catch(() => undefined);
}

/**
 * ทำให้ notification ที่ schedule ไว้ตรงกับ reminderAt ปัจจุบันของ task เสมอ:
 * ยกเลิกอันเก่า (ถ้ามี) → ขอ permission ถ้ายังไม่เคยถาม → schedule ใหม่ถ้ามีเวลาที่ยังไม่ผ่านไป → บันทึก id ลง DB
 * ไม่ throw — ถ้า permission ถูกปฏิเสธหรือ schedule ไม่สำเร็จ จะแค่เคลียร์ reminderNotificationId แล้ว return
 */
export async function syncTaskReminder(task: ReminderTask): Promise<void> {
  await cancelTaskReminder(task.reminderNotificationId);

  let notificationId: string | null = null;
  if (task.reminderAt && task.reminderAt > Date.now()) {
    const permission = await ensurePermission();
    if (permission === 'granted') {
      notificationId = await Notifications.scheduleNotificationAsync({
        content: { title: task.title, body: reminderBody(task.reminderAt), sound: true },
        trigger: {
          type: Notifications.SchedulableTriggerInputTypes.DATE,
          date: task.reminderAt,
          channelId: REMINDER_CHANNEL_ID,
        },
      }).catch(() => null);
    }
  }

  if (notificationId !== task.reminderNotificationId) {
    await db.update(tasks).set({ reminderNotificationId: notificationId }).where(eq(tasks.id, task.id));
  }
}

function reminderBody(reminderAt: number): string {
  return new Date(reminderAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
}
