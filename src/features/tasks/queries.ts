import { and, asc, between, eq, isNull } from 'drizzle-orm';
import { useLiveQuery } from 'drizzle-orm/expo-sqlite';

import { db, tasks } from '@/db';
import { now } from '@/lib/ids';

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
