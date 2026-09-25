import { describe, expect, it } from 'vitest';

import { average, checkinStreak, daySpend, isScaleValue, lastSevenDaysCheckins } from '../model';

describe('review model', () => {
  const today = new Date(2026, 8, 24, 15);
  const checkins = [
    { date: '2026-09-24', mood: 4, energy: 3 },
    { date: '2026-09-23', mood: 3, energy: 2 },
    { date: '2026-09-21', mood: 5, energy: null },
  ];

  it('fills the last 7 days, leaving gaps null', () => {
    const days = lastSevenDaysCheckins(checkins, today);
    expect(days.map((d) => d.date)).toEqual(['2026-09-18', '2026-09-19', '2026-09-20', '2026-09-21', '2026-09-22', '2026-09-23', '2026-09-24']);
    expect(days.map((d) => d.mood)).toEqual([null, null, null, 5, null, 3, 4]);
    expect(days.map((d) => d.energy)).toEqual([null, null, null, null, null, 2, 3]);
  });

  it('averages the non-null values, or null when there are none', () => {
    expect(average([4, 3, 5])).toBe(4);
    expect(average([1, 2])).toBe(1.5);
    expect(average([null, null])).toBeNull();
    expect(average([])).toBeNull();
  });

  it('counts the check-in streak, back from today or yesterday', () => {
    expect(checkinStreak(checkins, today)).toBe(2); // 24th, 23rd — 22nd is missing
    expect(checkinStreak(checkins.slice(1), today)).toBe(1); // nothing logged today → counts from yesterday
    expect(checkinStreak([], today)).toBe(0);
  });

  it('sums same-day, same-currency expenses only', () => {
    const txs = [
      { date: '2026-09-24', type: 'expense' as const, amount: 100, currency: 'THB' },
      { date: '2026-09-24', type: 'expense' as const, amount: 50, currency: 'GBP' },
      { date: '2026-09-24', type: 'income' as const, amount: 500, currency: 'THB' },
      { date: '2026-09-23', type: 'expense' as const, amount: 200, currency: 'THB' },
    ];
    expect(daySpend(txs, '2026-09-24', 'THB')).toBe(100);
  });

  it('validates a 1-5 scale value', () => {
    expect(isScaleValue(1)).toBe(true);
    expect(isScaleValue(5)).toBe(true);
    expect(isScaleValue(0)).toBe(false);
    expect(isScaleValue(6)).toBe(false);
  });
});
