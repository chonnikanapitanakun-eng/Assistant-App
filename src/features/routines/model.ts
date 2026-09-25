import type { Routine, RoutineTemplate } from '@/db';

/** Weekday numbers follow Date#getDay: 0 = Sunday … 6 = Saturday. */
export const ALL_DAYS = [0, 1, 2, 3, 4, 5, 6] as const;
/** Display order: Monday first. */
export const WEEK_ORDER = [1, 2, 3, 4, 5, 6, 0] as const;
export const WEEKDAYS = [1, 2, 3, 4, 5];
export const WEEKENDS = [0, 6];

export type Period = NonNullable<Routine['period']>;
export const PERIODS: Period[] = ['morning', 'day', 'night'];

/**
 * `routines.rule` is `daily` or `weekly:<days>` (e.g. `weekly:1,3,5`).
 * Returns the days it runs on, sorted; [] for an unknown or empty rule (never runs).
 */
export function ruleDays(rule: string): number[] {
  if (rule === 'daily') return [...ALL_DAYS];
  const m = /^weekly:([0-6](?:,[0-6])*)$/.exec(rule);
  if (!m) return [];
  return [...new Set(m[1].split(',').map(Number))].sort((a, b) => a - b);
}

/** Inverse of ruleDays. Every day collapses to `daily`. */
export function toRule(days: readonly number[]): string {
  const set = [...new Set(days)].filter((d) => Number.isInteger(d) && d >= 0 && d <= 6).sort((a, b) => a - b);
  return set.length === 7 ? 'daily' : `weekly:${set.join(',')}`;
}

const sameDays = (a: number[], b: number[]) => a.length === b.length && a.every((d, i) => d === b[i]);

/** Named shape of a rule, for labels: every day / weekdays / weekends / custom days. */
export function ruleKind(rule: string): 'daily' | 'weekdays' | 'weekends' | 'custom' | 'never' {
  const days = ruleDays(rule);
  if (days.length === 0) return 'never';
  if (days.length === 7) return 'daily';
  if (sameDays(days, WEEKDAYS)) return 'weekdays';
  if (sameDays(days, WEEKENDS)) return 'weekends';
  return 'custom';
}

/** Day of week for a YYYY-MM-DD key (local calendar date, no timezone shift). */
export function weekday(dateKey: string): number {
  const [y, m, d] = dateKey.split('-').map(Number);
  return new Date(y, m - 1, d).getDay();
}

export const occursOn = (rule: string, dateKey: string) => ruleDays(rule).includes(weekday(dateKey));

type Due = Pick<Routine, 'id' | 'rule' | 'active' | 'deletedAt'>;

/** Routines that should have a task on `dateKey` but don't yet (`existing` = routine ids already generated). */
export function routinesDue<R extends Due>(routines: R[], dateKey: string, existing: ReadonlySet<string>): R[] {
  return routines.filter((r) => r.active && !r.deletedAt && !existing.has(r.id) && occursOn(r.rule, dateKey));
}

/**
 * Id of the task a routine generates for one day. Deterministic, so two signed-in devices that both
 * generate today's task create the same row and cloud sync merges it by id (a random id per device
 * would collide on the unique (routine_id, date) index when the other device's row is pulled).
 */
export const routineTaskId = (routineId: string, dateKey: string) => `${routineId}_${dateKey}`;

export type GeneratedTask = {
  title: string;
  date: string;
  startTime: string | null;
  endTime: string | null;
  energy: RoutineTemplate['energy'] | null;
  areaId: string | null;
  routineId: string;
  checklist: { id: string; text: string; done: boolean }[] | null;
};

/** The task a routine creates for one day. `newId` is injected so this stays pure. */
export function taskFromRoutine(routine: Pick<Routine, 'id' | 'title' | 'areaId' | 'template'>, dateKey: string, newId: () => string): GeneratedTask {
  const tpl = routine.template ?? {};
  const steps = (tpl.steps ?? []).map((s) => s.trim()).filter(Boolean);
  return {
    title: routine.title,
    date: dateKey,
    startTime: tpl.startTime || null,
    endTime: (tpl.startTime && tpl.endTime) || null,
    energy: tpl.energy ?? null,
    areaId: routine.areaId,
    routineId: routine.id,
    checklist: steps.length ? steps.map((text) => ({ id: newId(), text, done: false })) : null,
  };
}

const periodRank = (p: Routine['period']) => (p ? PERIODS.indexOf(p) : PERIODS.length);

/** Morning → day → night → no period, then by start time, then title. */
export function sortRoutines<R extends Pick<Routine, 'period' | 'template' | 'title'>>(routines: R[]): R[] {
  return [...routines].sort(
    (a, b) =>
      periodRank(a.period) - periodRank(b.period) ||
      (a.template?.startTime ?? '99:99').localeCompare(b.template?.startTime ?? '99:99') ||
      a.title.localeCompare(b.title),
  );
}
