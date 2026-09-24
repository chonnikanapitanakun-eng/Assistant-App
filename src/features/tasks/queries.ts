import { and, asc, eq, isNull } from 'drizzle-orm';
import { useLiveQuery } from 'drizzle-orm/expo-sqlite';

import { areas, db, tasks, type Task } from '@/db';
import { cancelTaskReminder, syncTaskReminder } from '@/features/notifications';
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

/** Every live task — the Tasks screen groups and filters in memory (see model.ts). */
export function useAllTasks(): Task[] {
  const { data } = useLiveQuery(db.select().from(tasks).where(isNull(tasks.deletedAt)));
  return data;
}

/** Single task for task/[id]. `loaded` separates "still loading" from "not found". */
export function useTask(id: string): { task: Task | undefined; loaded: boolean } {
  const { data, updatedAt } = useLiveQuery(db.select().from(tasks).where(and(eq(tasks.id, id), isNull(tasks.deletedAt))), [id]);
  return { task: data[0], loaded: updatedAt !== undefined };
}

/** Life areas, parents first, used as task "projects". */
export function useAreas() {
  const { data } = useLiveQuery(db.select().from(areas).where(isNull(areas.deletedAt)).orderBy(asc(areas.sortOrder)));
  return data;
}

export type TaskFormValues = {
  title: string;
  notes: string | null;
  date: string | null;
  startTime: string | null;
  endTime: string | null;
  priority: number;
  energy: 'low' | 'med' | 'high' | null;
  areaId: string | null;
  isDone: boolean;
  checklist: ChecklistItem[] | null;
  /** Remind at the start time (needs date + start time). */
  remind: boolean;
};

function reminderFor(values: Pick<TaskFormValues, 'date' | 'startTime' | 'isDone' | 'remind'>): number | null {
  if (!values.remind || values.isDone) return null;
  return combineDateTime(values.date ?? undefined, values.startTime ?? undefined) ?? null;
}

export function createTask(values: TaskFormValues): string {
  const id = newId();
  const t = now();
  const { remind: _remind, ...rest } = values;
  const reminderAt = reminderFor(values);
  db.insert(tasks)
    .values({ id, createdAt: t, updatedAt: t, doneAt: values.isDone ? t : null, reminderAt, ...rest })
    .run();
  void syncTaskReminder({ id, title: values.title, reminderAt, reminderNotificationId: null });
  return id;
}

export function updateTask(existing: Task, values: TaskFormValues) {
  const { remind: _remind, ...rest } = values;
  const reminderAt = reminderFor(values);
  const t = now();
  db.update(tasks)
    .set({ ...rest, reminderAt, doneAt: values.isDone ? (existing.doneAt ?? t) : null, updatedAt: t })
    .where(eq(tasks.id, existing.id))
    .run();
  void syncTaskReminder({ id: existing.id, title: values.title, reminderAt, reminderNotificationId: existing.reminderNotificationId });
}

/** Tick / untick from a list. Completing cancels the reminder; reopening restores it. */
export function toggleTaskDone(task: Task) {
  const isDone = !task.isDone;
  const t = now();
  db.update(tasks).set({ isDone, doneAt: isDone ? t : null, updatedAt: t }).where(eq(tasks.id, task.id)).run();
  const reminderAt = isDone ? null : task.reminderAt;
  void syncTaskReminder({ id: task.id, title: task.title, reminderAt, reminderNotificationId: task.reminderNotificationId });
}

export function deleteTask(task: Task) {
  const t = now();
  db.update(tasks).set({ deletedAt: t, updatedAt: t }).where(eq(tasks.id, task.id)).run();
  void cancelTaskReminder(task.reminderNotificationId);
}

/** Sync read by id (for actions outside React). */
export function getTask(id: string): Task | undefined {
  return db.select().from(tasks).where(and(eq(tasks.id, id), isNull(tasks.deletedAt))).get();
}

/** Move a task to a date (and optional time). Keeps its reminder in sync. */
export function rescheduleTask(task: Task, date: string, startTime?: string | null, endTime?: string | null) {
  const reminderAt = !task.isDone && startTime ? (combineDateTime(date, startTime) ?? null) : null;
  db.update(tasks)
    .set({ date, startTime: startTime ?? null, endTime: endTime ?? null, reminderAt, updatedAt: now() })
    .where(eq(tasks.id, task.id))
    .run();
  void syncTaskReminder({ id: task.id, title: task.title, reminderAt, reminderNotificationId: task.reminderNotificationId });
}
