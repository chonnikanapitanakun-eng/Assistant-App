import { and, asc, eq, isNull } from 'drizzle-orm';

import { areas, db, tasks, useRows, type Task } from '@/db';
import { cancelTaskReminder, syncTaskReminder } from '@/features/notifications';
import { background } from '@/lib/background';
import { combineDateTime } from '@/lib/date';
import { newId, now } from '@/lib/ids';

export type ChecklistItem = { id: string; text: string; done: boolean };

export function useTasksForDate(date: string) {
  return useRows(db.select().from(tasks).where(and(eq(tasks.date, date), isNull(tasks.deletedAt))).orderBy(asc(tasks.startTime), asc(tasks.sortOrder))).data;
}

/** Every live task — the Tasks screen groups and filters in memory (see model.ts). */
export function useAllTasks(): Task[] {
  return useRows(db.select().from(tasks).where(isNull(tasks.deletedAt))).data;
}

/** Single task for task/[id]. `loaded` separates "still loading" from "not found". */
export function useTask(id: string): { task: Task | undefined; loaded: boolean } {
  const { data, loaded } = useRows(db.select().from(tasks).where(and(eq(tasks.id, id), isNull(tasks.deletedAt))));
  return { task: data[0], loaded };
}

/** Life areas, parents first, used as task "projects". */
export function useAreas() {
  return useRows(db.select().from(areas).where(isNull(areas.deletedAt)).orderBy(asc(areas.sortOrder))).data;
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

export async function createTask(values: TaskFormValues): Promise<string> {
  const id = newId();
  const t = now();
  const { remind: _remind, ...rest } = values;
  const reminderAt = reminderFor(values);
  await db.insert(tasks).values({ id, createdAt: t, updatedAt: t, doneAt: values.isDone ? t : null, reminderAt, ...rest });
  background(syncTaskReminder({ id, title: values.title, reminderAt, reminderNotificationId: null }), 'Task reminder');
  return id;
}

export async function updateTask(existing: Task, values: TaskFormValues) {
  const { remind: _remind, ...rest } = values;
  const reminderAt = reminderFor(values);
  const t = now();
  await db
    .update(tasks)
    .set({ ...rest, reminderAt, doneAt: values.isDone ? (existing.doneAt ?? t) : null, updatedAt: t })
    .where(eq(tasks.id, existing.id));
  background(syncTaskReminder({ id: existing.id, title: values.title, reminderAt, reminderNotificationId: existing.reminderNotificationId }), 'Task reminder');
}

/** Tick / untick from a list. Completing cancels the reminder; reopening restores it. */
export async function toggleTaskDone(task: Task) {
  const isDone = !task.isDone;
  const t = now();
  await db.update(tasks).set({ isDone, doneAt: isDone ? t : null, updatedAt: t }).where(eq(tasks.id, task.id));
  const reminderAt = isDone ? null : task.reminderAt;
  background(syncTaskReminder({ id: task.id, title: task.title, reminderAt, reminderNotificationId: task.reminderNotificationId }), 'Task reminder');
}

export async function deleteTask(task: Task) {
  const t = now();
  await db.update(tasks).set({ deletedAt: t, updatedAt: t }).where(eq(tasks.id, task.id));
  background(cancelTaskReminder(task.reminderNotificationId), 'Cancel task reminder');
}

/** Read by id (for actions outside React). */
export function getTask(id: string): Promise<Task | undefined> {
  return db.select().from(tasks).where(and(eq(tasks.id, id), isNull(tasks.deletedAt))).get();
}

/** Move a task to a date (and optional time). Keeps its reminder in sync. */
export async function rescheduleTask(task: Task, date: string, startTime?: string | null, endTime?: string | null) {
  const reminderAt = !task.isDone && startTime ? (combineDateTime(date, startTime) ?? null) : null;
  await db
    .update(tasks)
    .set({ date, startTime: startTime ?? null, endTime: endTime ?? null, reminderAt, updatedAt: now() })
    .where(eq(tasks.id, task.id));
  background(syncTaskReminder({ id: task.id, title: task.title, reminderAt, reminderNotificationId: task.reminderNotificationId }), 'Task reminder');
}
