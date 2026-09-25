import { describe, expect, it } from 'vitest';

import { isThaiHoliday, thaiHolidayOnDate, thaiHolidaysOfYear } from '../thai-holidays';

describe('thai-holidays', () => {
  it('finds a fixed-date holiday', () => {
    const h = thaiHolidayOnDate('2026-04-06');
    expect(h?.nameEn).toBe('Chakri Memorial Day');
  });

  it('finds a lunar-based holiday for the given year', () => {
    expect(thaiHolidayOnDate('2026-03-03')?.nameTh).toBe('วันมาฆบูชา');
    expect(thaiHolidayOnDate('2025-05-11')?.nameTh).toBe('วันวิสาขบูชา');
  });

  it('flags substitution/special holidays', () => {
    expect(thaiHolidayOnDate('2025-06-02')?.substitution).toBe(true);
    expect(thaiHolidayOnDate('2026-01-01')?.substitution).toBeUndefined();
  });

  it('returns undefined for a non-holiday date', () => {
    expect(thaiHolidayOnDate('2026-02-15')).toBeUndefined();
    expect(isThaiHoliday('2026-02-15')).toBe(false);
  });

  it('returns an empty list for a year without data', () => {
    expect(thaiHolidaysOfYear(2030)).toEqual([]);
  });

  it('lists a full year sorted by date', () => {
    const days = thaiHolidaysOfYear(2026).map((h) => h.date);
    expect(days).toEqual([...days].sort());
    expect(days.length).toBeGreaterThan(15);
  });
});
