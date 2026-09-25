import { eq } from 'drizzle-orm';
import * as Notifications from 'expo-notifications';
import { Platform } from 'react-native';

import { db, tasks } from '@/db';

import { ensurePermission } from './permissions';
import { REMINDER_CHANNEL_ID } from './setup';

export type ReminderTask = { id: string; title: string; reminderAt: number | null; reminderNotificationId: string | null };

/** ยกเลิก notification ที่ schedule ไว้ ถ้ามี — เรียกก่อน reschedule หรือตอนลบ/ปิดงานเสร็จเสมอ */
export async function cancelTaskReminder(notificationId: string | null) {
  if (!notificationId) return;
  await Notifications.cancelScheduledNotificationAsync(notificationId).catch(() => undefined);
}

/** Per-task queue: syncs for the same task run one after another, never interleaved. */
const queues = new Map<string, Promise<void>>();

/**
 * ทำให้ notification ที่ schedule ไว้ตรงกับ reminderAt ปัจจุบันของ task เสมอ:
 * ยกเลิกอันเก่า (ถ้ามี) → ขอ permission ถ้ายังไม่เคยถาม → schedule ใหม่ถ้ามีเวลาที่ยังไม่ผ่านไป → บันทึก id ลง DB
 * ไม่ throw — ถ้า permission ถูกปฏิเสธหรือ schedule ไม่สำเร็จ จะแค่เคลียร์ reminderNotificationId แล้ว return
 * Calls for the same task are serialised, so two quick edits cannot both leave a notification behind.
 */
export function syncTaskReminder(task: ReminderTask): Promise<void> {
  // Local notifications aren't available on web (same as the focus timer in ./focus.ts).
  if (Platform.OS === 'web') return Promise.resolve();
  const result = (queues.get(task.id) ?? Promise.resolve()).then(() => syncNow(task));
  const tail = result.catch(() => undefined);
  queues.set(task.id, tail);
  void tail.then(() => {
    if (queues.get(task.id) === tail) queues.delete(task.id);
  });
  return result;
}

const readReminderRow = (id: string) =>
  db
    .select({ reminderAt: tasks.reminderAt, reminderNotificationId: tasks.reminderNotificationId, isDone: tasks.isDone, deletedAt: tasks.deletedAt })
    .from(tasks)
    .where(eq(tasks.id, id))
    .get();

async function syncNow(task: ReminderTask): Promise<void> {
  // The caller's copy of the id can be stale (a previous sync stored a newer one), so cancel both.
  const before = await readReminderRow(task.id);
  await cancelTaskReminder(task.reminderNotificationId);
  if (before?.reminderNotificationId && before.reminderNotificationId !== task.reminderNotificationId) {
    await cancelTaskReminder(before.reminderNotificationId);
  }

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

  // The task may have changed while we awaited permission / scheduling (edited, ticked, deleted).
  const row = await readReminderRow(task.id);
  const stillWanted = !!row && row.deletedAt === null && !row.isDone && row.reminderAt === task.reminderAt;
  if (notificationId && !stillWanted) {
    await cancelTaskReminder(notificationId);
    notificationId = null;
  }
  if (!row) return;
  // Anything stored meanwhile is superseded by this sync.
  if (row.reminderNotificationId && row.reminderNotificationId !== notificationId) await cancelTaskReminder(row.reminderNotificationId);
  if (row.reminderNotificationId !== notificationId) {
    await db.update(tasks).set({ reminderNotificationId: notificationId }).where(eq(tasks.id, task.id));
  }
}

function reminderBody(reminderAt: number): string {
  return new Date(reminderAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
}
