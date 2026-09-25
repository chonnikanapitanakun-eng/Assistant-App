import { addDays, toDateKey } from './date';

export const repeatRules = ['daily', 'weekly', 'monthly', 'yearly'] as const;
export type RepeatRule = (typeof repeatRules)[number];

export const isRepeatRule = (v: unknown): v is RepeatRule => repeatRules.includes(v as RepeatRule);

const parse = (key: string) => {
  const [y, m, d] = key.split('-').map(Number);
  return { y, m: m - 1, d };
};

/** Day `day` of month `m` (0-based, may overflow into later years), clamped to the month's last day. */
function monthDay(y: number, m: number, day: number): Date {
  const last = new Date(y, m + 1, 0).getDate();
  return new Date(y, m, Math.min(day, last));
}

/**
 * The n-th occurrence (n = 0 is `start` itself). Monthly/yearly keep the start's day of month,
 * so a series on the 31st lands on the last day of shorter months and returns to the 31st after.
 */
export function occurrence(start: string, rule: RepeatRule, n: number): string {
  const { y, m, d } = parse(start);
  switch (rule) {
    case 'daily':
      return toDateKey(addDays(new Date(y, m, d), n));
    case 'weekly':
      return toDateKey(addDays(new Date(y, m, d), 7 * n));
    case 'monthly':
      return toDateKey(monthDay(y, m + n, d));
    case 'yearly':
      return toDateKey(monthDay(y + n, m, d));
  }
}

/** First occurrence strictly after `after` (a YYYY-MM-DD key), counting from `start`. */
export function nextOccurrence(start: string, rule: RepeatRule, after: string): string {
  // Jump close first so a years-old daily series doesn't loop thousands of times.
  const days = Math.max(0, Math.floor((parseTime(after) - parseTime(start)) / 86_400_000));
  const approx = rule === 'daily' ? days : rule === 'weekly' ? Math.floor(days / 7) : rule === 'monthly' ? Math.floor(days / 31) : Math.floor(days / 366);
  let n = Math.max(0, approx - 1);
  while (occurrence(start, rule, n) <= after) n++;
  return occurrence(start, rule, n);
}

/** Occurrences within [from, to) — `to` exclusive — at most `max`. */
export function occurrencesBetween(start: string, rule: RepeatRule, from: string, to: string, max = 400): string[] {
  const out: string[] = [];
  let date = start >= from ? start : nextOccurrence(start, rule, toDateKey(addDays(new Date(parseTime(from)), -1)));
  while (date < to && out.length < max) {
    out.push(date);
    date = nextOccurrence(start, rule, date);
  }
  return out;
}

function parseTime(key: string): number {
  const { y, m, d } = parse(key);
  return new Date(y, m, d).getTime();
}
