import { and, asc, between, eq, isNull } from 'drizzle-orm';
import { db, tasks, useDbQuery, type Task } from '@/db';
import { syncTaskReminder } from '@/features/notifications';
import { combineDateTime } from '@/lib/date';
import { newId, now } from '@/lib/ids';

export type ChecklistItem = { id: string; text: string; done: boolean };

export function useTasksForDate(date: string): Task[] {
  return (
    useDbQuery(['tasks', 'date', date], () =>
      db.select().from(tasks).where(and(eq(tasks.date, date), isNull(tasks.deletedAt))).orderBy(asc(tasks.startTime), asc(tasks.sortOrder)).all(),
    ) ?? []
  );
}

/** งานระหว่าง from–to (รวมทั้งสองวัน) สำหรับมุมมองสัปดาห์/เดือน */
export function useTasksInRange(from: string, to: string): Task[] {
  return (
    useDbQuery(['tasks', 'range', from, to], () =>
      db
        .select()
        .from(tasks)
        .where(and(between(tasks.date, from, to), isNull(tasks.deletedAt)))
        .orderBy(asc(tasks.date), asc(tasks.startTime), asc(tasks.sortOrder))
        .all(),
    ) ?? []
  );
}

/** reminder = วัน+เวลาเริ่มของงาน (กติกาเดียวกับ Quick Capture) */
const reminderFor = (date: string | null, startTime: string | null) => combineDateTime(date ?? undefined, startTime ?? undefined) ?? null;

/** ให้ notification ตรงกับสถานะงานใน DB — งานที่เสร็จหรือถูกลบจะถูกยกเลิก reminder */
async function syncReminder(id: string) {
  const task = await db.select().from(tasks).where(eq(tasks.id, id)).get();
  if (!task) return;
  const active = !task.isDone && task.deletedAt === null;
  void syncTaskReminder({ id, title: task.title, reminderAt: active ? task.reminderAt : null, reminderNotificationId: task.reminderNotificationId });
}

/** ย้ายเวลางาน (จาก drag-drop บน timeline) — reminder เลื่อนตาม */
export async function rescheduleTask(id: string, date: string | null, startTime: string, endTime: string) {
  await db.update(tasks).set({ startTime, endTime, reminderAt: reminderFor(date, startTime), updatedAt: now() }).where(eq(tasks.id, id)).run();
  await syncReminder(id);
}

export async function setTaskDone(id: string, isDone: boolean) {
  const t = now();
  await db.update(tasks).set({ isDone, doneAt: isDone ? t : null, updatedAt: t }).where(eq(tasks.id, id)).run();
  await syncReminder(id);
}

/** Task เดียวสำหรับหน้า task/[id] — undefined = ยังโหลดอยู่, null = ไม่พบ/ถูกลบ */
export function useTask(id: string): Task | null | undefined {
  return useDbQuery(['tasks', 'id', id], async () => (await db.select().from(tasks).where(and(eq(tasks.id, id), isNull(tasks.deletedAt))).get()) ?? null);
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

export async function createTask(values: TaskFormValues): Promise<string> {
  const id = newId();
  const t = now();
  await db
    .insert(tasks)
    .values({ id, createdAt: t, updatedAt: t, doneAt: values.isDone ? t : null, reminderAt: reminderFor(values.date, values.startTime), ...values })
    .run();
  await syncReminder(id);
  return id;
}

export async function updateTask(id: string, values: TaskFormValues) {
  await db
    .update(tasks)
    .set({ ...values, doneAt: values.isDone ? now() : null, reminderAt: reminderFor(values.date, values.startTime), updatedAt: now() })
    .where(eq(tasks.id, id))
    .run();
  await syncReminder(id);
}

export async function deleteTask(id: string) {
  const t = now();
  await db.update(tasks).set({ deletedAt: t, updatedAt: t }).where(eq(tasks.id, id)).run();
  await syncReminder(id);
}
