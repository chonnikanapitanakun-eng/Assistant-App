import { describe, expect, it } from 'vitest';

import { monthGrid, shiftDateKey, shiftMonth, startOfWeek, weekDays } from '../calendar';

describe('calendar helpers', () => {
  it('shifts date key', () => {
    expect(shiftDateKey('2026-12-31', 1)).toBe('2027-01-01');
  });

  it('finds Monday start of week', () => {
    expect(startOfWeek('2026-09-24')).toBe('2026-09-21'); // Thu → Mon
    expect(startOfWeek('2026-09-27')).toBe('2026-09-21'); // Sun → Mon
    expect(startOfWeek('2026-09-21')).toBe('2026-09-21');
  });

  it('lists 7 week days', () => {
    expect(weekDays('2026-09-24')).toEqual(['2026-09-21', '2026-09-22', '2026-09-23', '2026-09-24', '2026-09-25', '2026-09-26', '2026-09-27']);
  });

  it('builds 6x7 month grid starting Monday', () => {
    const grid = monthGrid('2026-09-24');
    expect(grid).toHaveLength(6);
    expect(grid[0][0]).toBe('2026-08-31');
    expect(grid[0][1]).toBe('2026-09-01');
    expect(grid[5][6]).toBe('2026-10-11');
  });

  it('shifts month clamping day', () => {
    expect(shiftMonth('2026-01-31', 1)).toBe('2026-02-28');
    expect(shiftMonth('2026-01-15', -1)).toBe('2025-12-15');
  });
});
