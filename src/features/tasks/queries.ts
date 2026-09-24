import { and, asc, between, eq, isNull } from 'drizzle-orm';
import { useLiveQuery } from 'drizzle-orm/expo-sqlite';

import { db, tasks, type Task } from '@/db';
import { syncTaskReminder } from '@/features/notifications';
import { combineDateTime } from '@/lib/date';
import { newId, now } from '@/lib/ids';

export type ChecklistItem = { id: string; text: string; done: boolean };

export function useTasksForDate(date: string) {
  const { data } = useLiveQuery(
    db.select().from(tasks).where(and(eq(tasks.date, date), isNull(tasks.deletedAt))).orderBy(asc(tasks.startTime), asc(tasks.sortOrder)),
    [date],
  );
  return data;
}

/** งานระหว่าง from–to (รวมทั้งสองวัน) สำหรับมุมมองสัปดาห์/เดือน */
export function useTasksInRange(from: string, to: string) {
  const { data } = useLiveQuery(
    db
      .select()
      .from(tasks)
      .where(and(between(tasks.date, from, to), isNull(tasks.deletedAt)))
      .orderBy(asc(tasks.date), asc(tasks.startTime), asc(tasks.sortOrder)),
    [from, to],
  );
  return data;
}

/** reminder = วัน+เวลาเริ่มของงาน (กติกาเดียวกับ Quick Capture) */
const reminderFor = (date: string | null, startTime: string | null) => combineDateTime(date ?? undefined, startTime ?? undefined) ?? null;

/** ให้ notification ตรงกับสถานะงานใน DB — งานที่เสร็จหรือถูกลบจะถูกยกเลิก reminder */
function syncReminder(id: string) {
  const task = db.select().from(tasks).where(eq(tasks.id, id)).get();
  if (!task) return;
  const active = !task.isDone && task.deletedAt === null;
  void syncTaskReminder({ id, title: task.title, reminderAt: active ? task.reminderAt : null, reminderNotificationId: task.reminderNotificationId });
}

/** ย้ายเวลางาน (จาก drag-drop บน timeline) — reminder เลื่อนตาม */
export function rescheduleTask(id: string, date: string | null, startTime: string, endTime: string) {
  db.update(tasks).set({ startTime, endTime, reminderAt: reminderFor(date, startTime), updatedAt: now() }).where(eq(tasks.id, id)).run();
  syncReminder(id);
}

export function setTaskDone(id: string, isDone: boolean) {
  const t = now();
  db.update(tasks).set({ isDone, doneAt: isDone ? t : null, updatedAt: t }).where(eq(tasks.id, id)).run();
  syncReminder(id);
}

/** Task เดียวสำหรับหน้า task/[id] — undefined = ยังโหลดอยู่หรือไม่พบ */
export function useTask(id: string): Task | undefined {
  const { data } = useLiveQuery(db.select().from(tasks).where(and(eq(tasks.id, id), isNull(tasks.deletedAt))), [id]);
  return data[0];
}

export type TaskFormValues = {
  title: string;
  notes: string | null;
  date: string | null;
  startTime: string | null;
  endTime: string | null;
  priority: number;
  energy: 'low' | 'med' | 'high' | null;
  isDone: boolean;
  checklist: ChecklistItem[] | null;
};

export function createTask(values: TaskFormValues): string {
  const id = newId();
  const t = now();
  db.insert(tasks)
    .values({ id, createdAt: t, updatedAt: t, doneAt: values.isDone ? t : null, reminderAt: reminderFor(values.date, values.startTime), ...values })
    .run();
  syncReminder(id);
  return id;
}

export function updateTask(id: string, values: TaskFormValues) {
  db.update(tasks)
    .set({ ...values, doneAt: values.isDone ? now() : null, reminderAt: reminderFor(values.date, values.startTime), updatedAt: now() })
    .where(eq(tasks.id, id))
    .run();
  syncReminder(id);
}

export function deleteTask(id: string) {
  const t = now();
  db.update(tasks).set({ deletedAt: t, updatedAt: t }).where(eq(tasks.id, id)).run();
  syncReminder(id);
}
