import { and, asc, between, eq, isNull } from 'drizzle-orm';
import { useLiveQuery } from 'drizzle-orm/expo-sqlite';

import { db, tasks, type Task } from '@/db';
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

/** ย้ายเวลางาน (จาก drag-drop บน timeline) */
export function rescheduleTask(id: string, startTime: string, endTime: string) {
  db.update(tasks).set({ startTime, endTime, updatedAt: now() }).where(eq(tasks.id, id)).run();
}

export function setTaskDone(id: string, isDone: boolean) {
  const t = now();
  db.update(tasks).set({ isDone, doneAt: isDone ? t : null, updatedAt: t }).where(eq(tasks.id, id)).run();
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
    .values({ id, createdAt: t, updatedAt: t, doneAt: values.isDone ? t : null, ...values })
    .run();
  return id;
}

export function updateTask(id: string, values: TaskFormValues) {
  db.update(tasks)
    .set({ ...values, doneAt: values.isDone ? now() : null, updatedAt: now() })
    .where(eq(tasks.id, id))
    .run();
}

export function deleteTask(id: string) {
  const t = now();
  db.update(tasks).set({ deletedAt: t, updatedAt: t }).where(eq(tasks.id, id)).run();
}
