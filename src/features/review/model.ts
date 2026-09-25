import { addDays, toDateKey } from '@/lib/date';

export const SCALE = [1, 2, 3, 4, 5] as const;
export type ScaleValue = (typeof SCALE)[number];

export const isScaleValue = (n: number): n is ScaleValue => SCALE.includes(n as ScaleValue);

type CheckinLike = { date: string; mood: number | null; energy: number | null };

/** Last 7 days (oldest first, today last), one slot per day — `null` where there's no check-in. */
export function lastSevenDaysCheckins<T extends CheckinLike>(checkins: T[], today: Date = new Date()) {
  const days = Array.from({ length: 7 }, (_, i) => toDateKey(addDays(today, i - 6)));
  const byDate = new Map(checkins.map((c) => [c.date, c]));
  return days.map((date) => ({ date, mood: byDate.get(date)?.mood ?? null, energy: byDate.get(date)?.energy ?? null }));
}

/** Mean of the non-null values, rounded to 1 decimal — `null` when there's nothing to average. */
export function average(values: (number | null | undefined)[]): number | null {
  const nums = values.filter((v): v is number => v != null);
  return nums.length ? Math.round((nums.reduce((s, v) => s + v, 0) / nums.length) * 10) / 10 : null;
}

/**
 * Consecutive days with a check-in, counting back from today (or yesterday if today's
 * isn't logged yet, so the streak isn't "lost" before the day is over).
 */
export function checkinStreak(checkins: { date: string }[], today: Date = new Date()): number {
  const dates = new Set(checkins.map((c) => c.date));
  let cursor = dates.has(toDateKey(today)) ? today : addDays(today, -1);
  let n = 0;
  while (dates.has(toDateKey(cursor))) {
    n++;
    cursor = addDays(cursor, -1);
  }
  return n;
}

type Tx = { date: string; type: 'income' | 'expense' | 'transfer'; amount: number; currency: string };

/** Total spent on one day, in one currency. */
export function daySpend(txs: Tx[], date: string, currency: string): number {
  return txs.filter((t) => t.date === date && t.type === 'expense' && t.currency === currency).reduce((sum, t) => sum + t.amount, 0);
}
