import { addDays, toDateKey } from '@/lib/date';

type Session = { startedAt: number; durationMin: number; completed: boolean };

/** Minutes focused per day for the last 7 days (oldest first, today last). */
export function lastSevenDays(sessions: Session[], today: Date = new Date()) {
  const days = Array.from({ length: 7 }, (_, i) => toDateKey(addDays(today, i - 6)));
  const totals = new Map(days.map((d) => [d, 0]));
  for (const s of sessions) {
    const key = toDateKey(new Date(s.startedAt));
    if (totals.has(key)) totals.set(key, totals.get(key)! + s.durationMin);
  }
  return days.map((date) => ({ date, minutes: totals.get(date)! }));
}

export function todayMinutes(sessions: Session[], today: Date = new Date()): number {
  const key = toDateKey(today);
  return sessions.filter((s) => toDateKey(new Date(s.startedAt)) === key).reduce((sum, s) => sum + s.durationMin, 0);
}

/**
 * Consecutive days with at least one completed session, counting back from today
 * (or from yesterday if nothing is completed yet today, so the streak isn't "lost" at breakfast).
 */
export function streak(sessions: Session[], today: Date = new Date()): number {
  const days = new Set(sessions.filter((s) => s.completed).map((s) => toDateKey(new Date(s.startedAt))));
  let cursor = days.has(toDateKey(today)) ? today : addDays(today, -1);
  let n = 0;
  while (days.has(toDateKey(cursor))) {
    n++;
    cursor = addDays(cursor, -1);
  }
  return n;
}
