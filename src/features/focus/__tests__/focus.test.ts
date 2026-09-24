import { describe, expect, it } from 'vitest';

import { lastSevenDays, streak, todayMinutes } from '../insights';
import { clock, elapsed, endsAt, extend, MIN, pause, progress, remaining, resume, settle, start } from '../timer';

describe('timer', () => {
  const t0 = 1_000_000;
  it('counts down from wall-clock time', () => {
    const s = start('focus', 25, t0, 'task1');
    expect(remaining(s, t0 + 5 * MIN)).toBe(20 * MIN);
    expect(progress(s, t0 + 5 * MIN)).toBeCloseTo(0.2);
    expect(endsAt(s, t0)).toBe(t0 + 25 * MIN);
  });
  it('freezes while paused and continues after resume', () => {
    const paused = pause(start('focus', 25, t0), t0 + 10 * MIN);
    expect(remaining(paused, t0 + 60 * MIN)).toBe(15 * MIN);
    const resumed = resume(paused, t0 + 60 * MIN);
    expect(remaining(resumed, t0 + 65 * MIN)).toBe(10 * MIN);
  });
  it('extends and settles into finished', () => {
    const s = extend(start('focus', 25, t0), 5);
    expect(remaining(s, t0)).toBe(30 * MIN);
    expect(settle(s, t0 + 29 * MIN).status).toBe('running');
    expect(settle(s, t0 + 31 * MIN)).toMatchObject({ status: 'finished', durationMs: 30 * MIN });
  });
  it('never reports more than the duration', () => {
    expect(elapsed(start('break', 5, t0), t0 + 99 * MIN)).toBe(5 * MIN);
  });
  it('formats the clock', () => {
    expect(clock(25 * MIN)).toBe('25:00');
    expect(clock(61_500)).toBe('01:02');
    expect(clock(90 * MIN)).toBe('1:30:00');
  });
});

describe('insights', () => {
  const today = new Date(2026, 8, 24, 15);
  const at = (d: number, h = 10) => new Date(2026, 8, d, h).getTime();
  const sessions = [
    { startedAt: at(24), durationMin: 25, completed: true },
    { startedAt: at(24, 14), durationMin: 10, completed: false },
    { startedAt: at(23), durationMin: 50, completed: true },
    { startedAt: at(22), durationMin: 25, completed: true },
    { startedAt: at(20), durationMin: 25, completed: true },
  ];
  it('sums today and the last seven days', () => {
    expect(todayMinutes(sessions, today)).toBe(35);
    expect(lastSevenDays(sessions, today).map((d) => d.minutes)).toEqual([0, 0, 25, 0, 25, 50, 35]);
  });
  it('counts the streak of completed days', () => {
    expect(streak(sessions, today)).toBe(3);
    expect(streak(sessions.slice(2), today)).toBe(2); // nothing yet today → counts from yesterday
    expect(streak([], today)).toBe(0);
  });
});
