import { and, eq, isNotNull, isNull } from 'drizzle-orm';
import { useEffect } from 'react';
import { AppState } from 'react-native';

import { commit, db, routines, tasks, useRows, type Routine, type RoutineTemplate } from '@/db';
import { syncTaskReminder } from '@/features/notifications';
import { background } from '@/lib/background';
import { combineDateTime, toDateKey } from '@/lib/date';
import { newId, now } from '@/lib/ids';

import { routinesDue, taskFromRoutine } from './model';

export function useRoutines(): Routine[] {
  return useRows(db.select().from(routines).where(isNull(routines.deletedAt))).data;
}

/** Single routine for routine/[id]. `loaded` separates "still loading" from "not found". */
export function useRoutine(id: string): { routine: Routine | undefined; loaded: boolean } {
  const { data, loaded } = useRows(db.select().from(routines).where(and(eq(routines.id, id), isNull(routines.deletedAt))));
  return { routine: data[0], loaded };
}

export type RoutineFormValues = {
  title: string;
  rule: string;
  period: Routine['period'];
  areaId: string | null;
  active: boolean;
  template: RoutineTemplate;
};

// Create / edit / resume run the generator so a routine due today shows up right away.
// Editing never rewrites a task already generated — today's task keeps what it was created with.

export async function createRoutine(values: RoutineFormValues): Promise<string> {
  const id = newId();
  const t = now();
  await db.insert(routines).values({ id, createdAt: t, updatedAt: t, ...values });
  background(generateRoutineTasks(), 'Generate routine tasks');
  return id;
}

export async function updateRoutine(id: string, values: RoutineFormValues) {
  await db.update(routines).set({ ...values, updatedAt: now() }).where(eq(routines.id, id));
  background(generateRoutineTasks(), 'Generate routine tasks');
}

export async function setRoutineActive(id: string, active: boolean) {
  await db.update(routines).set({ active, updatedAt: now() }).where(eq(routines.id, id));
  if (active) background(generateRoutineTasks(), 'Generate routine tasks');
}

/** Soft delete. Tasks it already created stay (they are ordinary tasks now). */
export async function deleteRoutine(id: string) {
  const t = now();
  await db.update(routines).set({ deletedAt: t, updatedAt: t }).where(eq(routines.id, id));
}

/**
 * Create today's task for every active routine whose rule matches and that has none yet.
 * Only the given day — days the app wasn't opened are not back-filled.
 * Runs one at a time (launch, resume and a save can overlap); the unique (routine_id, date) index
 * is the backstop, and it also covers tasks the user deleted, so those are not recreated.
 */
let chain: Promise<unknown> = Promise.resolve();
export function generateRoutineTasks(date: string = toDateKey()): Promise<number> {
  const run = chain.then(() => generate(date));
  chain = run.catch(() => undefined);
  return run;
}

async function generate(date: string): Promise<number> {
  const [live, made] = await Promise.all([
    db.select().from(routines).where(and(isNull(routines.deletedAt), eq(routines.active, true))).all(),
    // Deleted tasks count too: deleting today's routine task means "skip today".
    db.select({ routineId: tasks.routineId }).from(tasks).where(and(eq(tasks.date, date), isNotNull(tasks.routineId))).all(),
  ]);
  const due = routinesDue(live, date, new Set(made.map((m) => m.routineId!)));
  if (due.length === 0) return 0;

  const t = now();
  const rows = due.map((r) => {
    const task = taskFromRoutine(r, date, newId);
    return { ...task, id: newId(), createdAt: t, updatedAt: t, reminderAt: combineDateTime(date, task.startTime ?? undefined) ?? null };
  });
  await commit(rows.map((row) => db.insert(tasks).values(row).onConflictDoNothing()));
  for (const row of rows) {
    if (row.reminderAt) background(syncTaskReminder({ id: row.id, title: row.title, reminderAt: row.reminderAt, reminderNotificationId: null }), 'Task reminder');
  }
  return rows.length;
}

/** Generate routine tasks once the DB is ready and whenever the app comes back to the foreground. */
export function useRoutineTasks(ready: boolean) {
  useEffect(() => {
    if (!ready) return;
    background(generateRoutineTasks(), 'Generate routine tasks');
    const sub = AppState.addEventListener('change', (state) => {
      if (state === 'active') background(generateRoutineTasks(), 'Generate routine tasks');
    });
    return () => sub.remove();
  }, [ready]);
}
