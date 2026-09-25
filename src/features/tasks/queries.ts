import { and, asc, eq, isNull } from 'drizzle-orm';

import { areas, db, tasks, useRows, type Task } from '@/db';
import { cancelTaskReminder, syncTaskReminder } from '@/features/notifications';
import { background } from '@/lib/background';
import { combineDateTime, toDateKey } from '@/lib/date';
import { newId, now } from '@/lib/ids';
import { nextOccurrence, type RepeatRule } from '@/lib/recurrence';


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
  /** Minutes before the start time (09:00 when untimed); null = no reminder. Needs a date. */
  remindBefore: number | null;
  /** Needs a date; completing the task creates the next one. */
  repeat: RepeatRule | null;
};

/** When untimed tasks remind (on their day, minus `remindBefore`). */
export const UNTIMED_REMINDER_TIME = '09:00';

export function reminderFor(values: Pick<TaskFormValues, 'date' | 'startTime' | 'isDone' | 'remindBefore'>): number | null {
  if (values.remindBefore === null || values.isDone || !values.date) return null;
  const base = combineDateTime(values.date, values.startTime ?? UNTIMED_REMINDER_TIME);
  return base === undefined ? null : base - values.remindBefore * 60_000;
}

export async function createTask(values: TaskFormValues): Promise<string> {
  const id = newId();
  const t = now();
  const reminderAt = reminderFor(values);
  const rest = { ...values, repeat: values.date ? values.repeat : null };
  await db.insert(tasks).values({ id, createdAt: t, updatedAt: t, doneAt: values.isDone ? t : null, reminderAt, ...rest });
  background(syncTaskReminder({ id, title: values.title, reminderAt, reminderNotificationId: null }), 'Task reminder');
  return id;
}

export async function updateTask(existing: Task, values: TaskFormValues) {
  const reminderAt = reminderFor(values);
  const rest = { ...values, repeat: values.date ? values.repeat : null };
  const t = now();
  await db
    .update(tasks)
    .set({ ...rest, reminderAt, doneAt: values.isDone ? (existing.doneAt ?? t) : null, updatedAt: t })
    .where(eq(tasks.id, existing.id));
  background(syncTaskReminder({ id: existing.id, title: values.title, reminderAt, reminderNotificationId: existing.reminderNotificationId }), 'Task reminder');
}

/**
 * Tick / untick from a list. Completing cancels the reminder; reopening restores it.
 * A repeating task spawns its next occurrence when completed; reopening removes that copy again
 * (unless it has been ticked off itself).
 */
export async function toggleTaskDone(task: Task) {
  const isDone = !task.isDone;
  const t = now();
  await db.update(tasks).set({ isDone, doneAt: isDone ? t : null, updatedAt: t }).where(eq(tasks.id, task.id));
  const reminderAt = isDone ? null : task.reminderAt;
  background(syncTaskReminder({ id: task.id, title: task.title, reminderAt, reminderNotificationId: task.reminderNotificationId }), 'Task reminder');
  if (task.repeat && task.date) {
    if (isDone) await spawnNext(task);
    else await removeSpawned(task.id);
  }
}

async function spawnedFrom(id: string): Promise<Task | undefined> {
  return db.select().from(tasks).where(and(eq(tasks.repeatFromId, id), isNull(tasks.deletedAt))).get();
}

async function spawnNext(task: Task) {
  if (!task.repeat || !task.date || (await spawnedFrom(task.id))) return;
  // Never behind today: finishing an overdue daily task schedules tomorrow, not another missed day.
  const today = toDateKey();
  const after = task.date > today ? task.date : today;
  const values: TaskFormValues = {
    title: task.title,
    notes: task.notes,
    date: nextOccurrence(task.date, task.repeat, after),
    startTime: task.startTime,
    endTime: task.endTime,
    priority: task.priority,
    energy: task.energy,
    areaId: task.areaId,
    isDone: false,
    checklist: task.checklist?.map((c) => ({ ...c, done: false })) ?? null,
    remindBefore: task.remindBefore,
    repeat: task.repeat,
  };
  const id = await createTask(values);
  await db.update(tasks).set({ repeatFromId: task.id }).where(eq(tasks.id, id));
}

async function removeSpawned(id: string) {
  const next = await spawnedFrom(id);
  if (next && !next.isDone) await deleteTask(next);
}

export async function deleteTask(task: Task) {
  const t = now();
  await db.update(tasks).set({ deletedAt: t, updatedAt: t }).where(eq(tasks.id, task.id));
  background(cancelTaskReminder(task.reminderNotificationId), 'Cancel task reminder');
}

/** Undo a delete. The old reminder was cancelled, so schedule it again. */
export async function restoreTask(task: Task) {
  await db.update(tasks).set({ deletedAt: null, updatedAt: now() }).where(eq(tasks.id, task.id));
  background(syncTaskReminder({ id: task.id, title: task.title, reminderAt: task.isDone ? null : task.reminderAt, reminderNotificationId: null }), 'Task reminder');
}

/** Read by id (for actions outside React). */
export function getTask(id: string): Promise<Task | undefined> {
  return db.select().from(tasks).where(and(eq(tasks.id, id), isNull(tasks.deletedAt))).get();
}

/** Move a task to a date (and optional time). An existing reminder follows the new time. */
export async function rescheduleTask(task: Task, date: string, startTime?: string | null, endTime?: string | null) {
  const reminderAt = reminderFor({ date, startTime: startTime ?? null, isDone: task.isDone, remindBefore: task.remindBefore });
  await db
    .update(tasks)
    .set({ date, startTime: startTime ?? null, endTime: endTime ?? null, reminderAt, updatedAt: now() })
    .where(eq(tasks.id, task.id));
  background(syncTaskReminder({ id: task.id, title: task.title, reminderAt, reminderNotificationId: task.reminderNotificationId }), 'Task reminder');
}
