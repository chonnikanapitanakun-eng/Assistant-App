import { describe, expect, it } from 'vitest';

import { HOUR_HEIGHT, layoutOverlaps, minutesToTime, minutesToY, moveSpan, snap, taskSpan, timeToMinutes, yToMinutes } from '../timeline';

const t = (startTime: string | null, endTime: string | null = null, durationMin: number | null = null) => ({ startTime, endTime, durationMin });

describe('timeline', () => {
  it('converts time <-> minutes', () => {
    expect(timeToMinutes('09:30')).toBe(570);
    expect(minutesToTime(570)).toBe('09:30');
    expect(minutesToTime(5)).toBe('00:05');
  });

  it('snaps to 15 min', () => {
    expect(snap(67)).toBe(60);
    expect(snap(68)).toBe(75);
  });

  it('maps minutes <-> y', () => {
    expect(minutesToY(7 * 60)).toBe(HOUR_HEIGHT);
    expect(yToMinutes(HOUR_HEIGHT * 2)).toBe(8 * 60);
  });

  it('computes span with end, duration or default', () => {
    expect(taskSpan(t(null))).toBeNull();
    expect(taskSpan(t('09:00', '10:30'))).toEqual({ start: 540, end: 630 });
    expect(taskSpan(t('09:00', null, 30))).toEqual({ start: 540, end: 570 });
    expect(taskSpan(t('09:00'))).toEqual({ start: 540, end: 600 });
    expect(taskSpan(t('09:00', '09:00'))).toEqual({ start: 540, end: 555 });
  });

  it('moves span keeping length, snapped and clamped', () => {
    expect(moveSpan({ start: 540, end: 600 }, 37)).toEqual({ startTime: '09:30', endTime: '10:30' });
    expect(moveSpan({ start: 420, end: 480 }, -300)).toEqual({ startTime: '06:00', endTime: '07:00' });
    expect(moveSpan({ start: 1320, end: 1380 }, 300)).toEqual({ startTime: '23:00', endTime: '23:59' });
  });

  it('lays out overlapping tasks in columns', () => {
    const a = t('09:00', '10:00');
    const b = t('09:30', '10:30');
    const c = t('11:00', '12:00');
    const out = layoutOverlaps([c, b, a, t(null)]);
    expect(out.map((p) => [p.item, p.column, p.columns])).toEqual([
      [a, 0, 2],
      [b, 1, 2],
      [c, 0, 1],
    ]);
  });
});
