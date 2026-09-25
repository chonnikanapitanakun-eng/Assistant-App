import { describe, expect, it } from 'vitest';

import { nextOccurrence, occurrence, occurrencesBetween } from '../recurrence';

describe('recurrence', () => {
  it('steps each rule', () => {
    expect(occurrence('2026-09-25', 'daily', 7)).toBe('2026-10-02');
    expect(occurrence('2026-09-25', 'weekly', 2)).toBe('2026-10-09');
    expect(occurrence('2026-12-15', 'monthly', 1)).toBe('2027-01-15');
    expect(occurrence('2026-09-25', 'yearly', 1)).toBe('2027-09-25');
  });
  it('clamps month ends without drifting', () => {
    expect([1, 2, 3].map((n) => occurrence('2026-01-31', 'monthly', n))).toEqual(['2026-02-28', '2026-03-31', '2026-04-30']);
    expect(occurrence('2028-02-29', 'yearly', 1)).toBe('2029-02-28');
  });
  it('finds the next occurrence after a date', () => {
    expect(nextOccurrence('2026-09-01', 'weekly', '2026-09-25')).toBe('2026-09-29');
    expect(nextOccurrence('2026-09-25', 'daily', '2026-09-25')).toBe('2026-09-26');
    expect(nextOccurrence('2020-01-01', 'daily', '2026-09-25')).toBe('2026-09-26');
    expect(nextOccurrence('2026-10-01', 'monthly', '2026-09-25')).toBe('2026-10-01');
  });
  it('lists occurrences in a range', () => {
    expect(occurrencesBetween('2026-09-01', 'weekly', '2026-09-14', '2026-10-01')).toEqual(['2026-09-15', '2026-09-22', '2026-09-29']);
    expect(occurrencesBetween('2026-09-20', 'daily', '2026-09-01', '2026-09-23')).toEqual(['2026-09-20', '2026-09-21', '2026-09-22']);
    expect(occurrencesBetween('2026-10-05', 'monthly', '2026-09-01', '2026-10-01')).toEqual([]);
  });
});
