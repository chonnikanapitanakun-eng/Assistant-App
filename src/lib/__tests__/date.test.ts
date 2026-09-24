import { describe, expect, it } from 'vitest';

import { addDays, greetingKey, toBuddhistYear, toDateKey, toMonthKey } from '../date';

describe('date helpers', () => {
  it('formats date key', () => {
    expect(toDateKey(new Date(2026, 8, 24))).toBe('2026-09-24');
    expect(toMonthKey(new Date(2026, 0, 5))).toBe('2026-01');
  });
  it('adds days across month boundary', () => {
    expect(toDateKey(addDays(new Date(2026, 0, 31), 1))).toBe('2026-02-01');
  });
  it('converts to Buddhist year', () => {
    expect(toBuddhistYear(2026)).toBe(2569);
  });
  it('picks greeting by hour', () => {
    expect(greetingKey(new Date(2026, 0, 1, 8))).toBe('greeting_morning');
    expect(greetingKey(new Date(2026, 0, 1, 14))).toBe('greeting_afternoon');
    expect(greetingKey(new Date(2026, 0, 1, 20))).toBe('greeting_evening');
  });
});
