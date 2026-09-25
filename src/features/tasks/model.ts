import type { Task } from '@/db';
import type { TintName } from '@/theme';

/** DB stores priority as 1 (high) · 2 (normal) · 3 (low). */
export type PriorityLevel = 'high' | 'medium' | 'low';
export const priorityLevel = (p: number): PriorityLevel => (p <= 1 ? 'high' : p >= 3 ? 'low' : 'medium');
export const priorityValue: Record<PriorityLevel, number> = { high: 1, medium: 2, low: 3 };
export const priorityTint: Record<PriorityLevel, TintName> = { high: 'priorityHigh', medium: 'priorityMedium', low: 'priorityLow' };

export type TaskFilter = 'all' | 'today' | 'upcoming' | 'done';
export type Energy = NonNullable<Task['energy']>;
export type SectionKey = 'overdue' | 'today' | 'upcoming' | 'anytime' | 'done';
export type TaskSection = { key: SectionKey; tasks: Task[] };

type Groupable = Pick<Task, 'date' | 'startTime' | 'isDone' | 'priority' | 'sortOrder' | 'doneAt' | 'createdAt'>;

const byWhen = (a: Groupable, b: Groupable) =>
  (a.date ?? '9999').localeCompare(b.date ?? '9999') ||
  (a.startTime ?? '99:99').localeCompare(b.startTime ?? '99:99') ||
  a.priority - b.priority ||
  a.sortOrder - b.sortOrder ||
  a.createdAt - b.createdAt;

/** Bucket open tasks by time; done tasks go to their own section. Empty sections are dropped. */
export function groupTasks<T extends Groupable>(tasks: T[], today: string, filter: TaskFilter): { key: SectionKey; tasks: T[] }[] {
  const open = tasks.filter((t) => !t.isDone).sort(byWhen);
  const done = tasks.filter((t) => t.isDone).sort((a, b) => (b.doneAt ?? 0) - (a.doneAt ?? 0));
  const overdue = open.filter((t) => t.date && t.date < today);
  const todays = open.filter((t) => t.date === today);
  const upcoming = open.filter((t) => t.date && t.date > today);
  const anytime = open.filter((t) => !t.date);

  const sections: { key: SectionKey; tasks: T[] }[] =
    filter === 'today'
      ? [
          { key: 'overdue', tasks: overdue },
          { key: 'today', tasks: todays },
        ]
      : filter === 'upcoming'
        ? [{ key: 'upcoming', tasks: upcoming }]
        : filter === 'done'
          ? [{ key: 'done', tasks: done }]
          : [
              { key: 'overdue', tasks: overdue },
              { key: 'today', tasks: todays },
              { key: 'upcoming', tasks: upcoming },
              { key: 'anytime', tasks: anytime },
            ];
  return sections.filter((s) => s.tasks.length > 0);
}

/** Progress for today's tasks (overdue excluded so the ring can reach 100%). */
export function todayProgress(tasks: Groupable[], today: string) {
  const todays = tasks.filter((t) => t.date === today);
  const done = todays.filter((t) => t.isDone).length;
  return { done, total: todays.length, ratio: todays.length ? done / todays.length : 0 };
}

/** Open tasks that need attention now: overdue first, then today's by priority. */
export function attentionTasks<T extends Groupable>(tasks: T[], today: string, limit = 3): T[] {
  const open = tasks.filter((t) => !t.isDone && t.date && t.date <= today);
  return open
    .sort((a, b) => Number(b.date! < today) - Number(a.date! < today) || a.priority - b.priority || byWhen(a, b))
    .slice(0, limit);
}

export const isValidTime = (v: string) => /^([01]\d|2[0-3]):[0-5]\d$/.test(v);
/** YYYY-MM-DD that is a real calendar date (rejects e.g. 2026-02-30). */
export const isValidDate = (v: string) => {
  if (!/^\d{4}-(0[1-9]|1[0-2])-(0[1-9]|[12]\d|3[01])$/.test(v)) return false;
  const [y, m, d] = v.split('-').map(Number);
  const date = new Date(y, m - 1, d);
  return date.getFullYear() === y && date.getMonth() === m - 1 && date.getDate() === d;
};

