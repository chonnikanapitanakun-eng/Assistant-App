import { afterAll, describe, expect, it } from 'vitest';

import { eventInRange, eventRange, eventToItem } from '../model';

// Node applies a runtime change to process.env.TZ; each test file runs in its own process.
const originalTz = process.env.TZ;
const inTz = <T>(tz: string, fn: () => T): T => {
  process.env.TZ = tz;
  return fn();
};
afterAll(() => {
  process.env.TZ = originalTz;
});

const form = (date: string, startTime: string, endTime: string, allDay = false) => ({ date, allDay, startTime, endTime });
const row = (r: { start: number; end: number }, isAllDay: boolean) => ({ id: 'e', title: 'e', location: null, isAllDay, ...r });

it('can switch timezone at runtime (guards the tests below)', () => {
  expect(inTz('Asia/Bangkok', () => new Date(2026, 0, 1).getTimezoneOffset())).toBe(-420);
  expect(inTz('America/New_York', () => new Date(2026, 0, 1).getTimezoneOffset())).toBe(300);
});

describe('timed events across DST', () => {
  it('keeps wall-clock time on the day clocks go forward (London)', () => {
    inTz('Europe/London', () => {
      const r = eventRange(form('2026-03-29', '10:00', '11:30'));
      expect(new Date(r.start).getHours()).toBe(10);
      expect(eventToItem(row(r, false))).toMatchObject({ date: '2026-03-29', start: '10:00', end: '11:30' });
    });
  });
  it('keeps wall-clock time on the day clocks go back (London)', () => {
    inTz('Europe/London', () => {
      expect(eventToItem(row(eventRange(form('2026-10-25', '18:00', '19:00')), false))).toMatchObject({ date: '2026-10-25', start: '18:00', end: '19:00' });
    });
  });
});

describe('all-day events are timezone-independent', () => {
  it('stores UTC midnight for one day', () => {
    expect(eventRange(form('2026-09-24', '', '', true))).toEqual({ start: Date.UTC(2026, 8, 24), end: Date.UTC(2026, 8, 25) });
  });
  it('reads back on the same date after moving Bangkok → London → New York', () => {
    const r = inTz('Asia/Bangkok', () => eventRange(form('2026-09-24', '', '', true)));
    for (const tz of ['Asia/Bangkok', 'Europe/London', 'America/New_York', 'Pacific/Kiritimati']) {
      expect(inTz(tz, () => eventToItem(row(r, true)).date)).toBe('2026-09-24');
    }
  });
  it('still reads legacy local-midnight rows in the zone they were written', () => {
    inTz('Asia/Bangkok', () => {
      const legacy = { start: new Date(2026, 8, 24).getTime(), end: new Date(2026, 8, 25).getTime() };
      expect(eventToItem(row(legacy, true)).date).toBe('2026-09-24');
    });
  });
  it('matches the range by date key in any timezone', () => {
    const r = eventRange(form('2026-09-24', '', '', true));
    for (const tz of ['Asia/Bangkok', 'America/New_York']) {
      inTz(tz, () => {
        const e = row(r, true);
        expect([eventInRange(e, '2026-09-23', '2026-09-24'), eventInRange(e, '2026-09-24', '2026-09-25'), eventInRange(e, '2026-09-25', '2026-09-26')]).toEqual([false, true, false]);
      });
    }
  });
  it('includes multi-day all-day events that started before the range', () => {
    const e = row({ start: Date.UTC(2026, 8, 22), end: Date.UTC(2026, 8, 25) }, true);
    expect([eventInRange(e, '2026-09-24', '2026-09-25'), eventInRange(e, '2026-09-25', '2026-09-26')]).toEqual([true, false]);
  });
});

describe('timed events in range', () => {
  it('matches by local start time', () => {
    inTz('Asia/Bangkok', () => {
      const e = row(eventRange(form('2026-09-24', '23:30', '23:45')), false);
      expect([eventInRange(e, '2026-09-24', '2026-09-25'), eventInRange(e, '2026-09-25', '2026-09-26')]).toEqual([true, false]);
    });
  });
});
