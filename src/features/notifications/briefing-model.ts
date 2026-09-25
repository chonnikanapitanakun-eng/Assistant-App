import { addDays, toDateKey } from '@/lib/date';

export const BRIEFING_DAYS = 7;

export type BriefingCounts = { events: number; tasks: number; overdue: number; bills: number; firstEvent?: { title: string; start: string } };
export type BriefingPlan = { date: string; at: number; title: string; body: string };
/** Translation function (i18next-compatible) so this stays pure and testable. */
export type T = (key: string, opts?: Record<string, unknown>) => string;

/** The next `days` mornings at hour:minute (local), starting today if that time is still ahead. */
export function briefingTimes(hour: number, minute: number, days = BRIEFING_DAYS, now: Date = new Date()): { date: string; at: number }[] {
  const out: { date: string; at: number }[] = [];
  for (let i = 0; out.length < days; i++) {
    const d = addDays(now, i);
    const at = new Date(d.getFullYear(), d.getMonth(), d.getDate(), hour, minute).getTime();
    if (at > now.getTime()) out.push({ date: toDateKey(d), at });
  }
  return out;
}

/** "3 events, 5 tasks and 1 bill · First: Meeting with John 10:00" — from local rows, so it works offline. */
export function briefingBody(t: T, c: BriefingCounts): string {
  const parts = [
    c.events ? t('home.part_events', { count: c.events }) : null,
    c.tasks ? t('home.part_tasks', { count: c.tasks }) : null,
    c.bills ? t('home.part_bills', { count: c.bills }) : null,
  ].filter((x): x is string => !!x);
  const list = parts.length ? joinList(parts, t('home.list_sep'), t('home.list_and')) : t('review.briefing_nothing');
  const tail = c.overdue ? t('review.briefing_overdue', { count: c.overdue }) : c.firstEvent ? t('review.briefing_first', { title: c.firstEvent.title, time: c.firstEvent.start }) : null;
  return tail ? `${list} · ${tail}` : list;
}

function joinList(items: string[], sep: string, and: string): string {
  if (items.length <= 1) return items.join('');
  return `${items.slice(0, -1).join(sep)}${and}${items[items.length - 1]}`;
}

