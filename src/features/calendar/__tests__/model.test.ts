import { describe, expect, it } from 'vitest';

import { countByDay, eventToItem, hourRange, itemsForDay, layoutTimeline, mergeItems, monthGrid, moveSlot, scheduleStatus, shiftDate, taskToItem, weekDays } from '../model';

const at = (d: string, t: string) => new Date(`${d}T${t}:00`).getTime();
const ev = (id: string, d: string, s: string, e: string, isAllDay = false) => ({ id, title: id, start: at(d, s), end: at(d, e), isAllDay, location: null });
const task = (id: string, date: string | null, startTime: string | null = null, endTime: string | null = null, isDone = false) => ({ id, title: id, date, startTime, endTime, isDone, priority: 2 });

describe('conversion', () => {
  it('turns an event into local date + times', () => {
    expect(eventToItem(ev('a', '2026-09-24', '09:00', '10:30'))).toMatchObject({ date: '2026-09-24', start: '09:00', end: '10:30', allDay: false });
  });
  it('clips events that run past midnight', () => {
    const e = { ...ev('late', '2026-09-24', '23:00', '23:30'), end: at('2026-09-25', '01:00') };
    expect(eventToItem(e).end).toBe('23:59');
  });
  it('gives timed tasks 30 min and puts untimed ones in all-day', () => {
    expect(taskToItem(task('t', '2026-09-24', '13:00'))).toMatchObject({ start: '13:00', end: '13:30', allDay: false });
    expect(taskToItem(task('u', '2026-09-24'))).toMatchObject({ allDay: true });
    expect(taskToItem(task('n', null))).toBeNull();
  });
});

describe('merge + day', () => {
  const items = mergeItems([ev('meet', '2026-09-24', '10:00', '11:00'), ev('bday', '2026-09-24', '00:00', '23:59', true)], [task('work', '2026-09-24', '09:00'), task('due', '2026-09-24'), task('done', '2026-09-24', null, null, true)]);
  it('sorts all-day first, then by start time', () => {
    expect(items.map((i) => i.id)).toEqual(['bday', 'due', 'done', 'work', 'meet']);
  });
  it('splits a day into all-day and timed', () => {
    const d = itemsForDay(items, '2026-09-24');
    expect(d.allDay.map((i) => i.id)).toEqual(['bday', 'due', 'done']);
    expect(d.timed.map((i) => i.id)).toEqual(['work', 'meet']);
  });
  it('counts events and open tasks per day', () => {
    expect(countByDay(items).get('2026-09-24')).toEqual({ events: 2, tasks: 2 });
  });
});

describe('grids', () => {
  it('builds a Monday-first week', () => {
    expect(weekDays('2026-09-24')).toEqual(['2026-09-21', '2026-09-22', '2026-09-23', '2026-09-24', '2026-09-25', '2026-09-26', '2026-09-27']);
  });
  it('builds a 6-week month grid starting on Monday', () => {
    const g = monthGrid('2026-09-24');
    expect(g).toHaveLength(42);
    expect(g[0]).toEqual({ date: '2026-08-31', inMonth: false });
    expect(g[1]).toEqual({ date: '2026-09-01', inMonth: true });
  });
  it('shifts by day, week and month (clamping month end)', () => {
    expect(shiftDate('2026-09-24', 'day', 1)).toBe('2026-09-25');
    expect(shiftDate('2026-09-24', 'week', -1)).toBe('2026-09-17');
    expect(shiftDate('2026-01-31', 'month', 1)).toBe('2026-02-28');
  });
});

describe('timeline layout', () => {
  const items = mergeItems([ev('a', '2026-09-24', '09:00', '10:00'), ev('b', '2026-09-24', '09:30', '10:30'), ev('c', '2026-09-24', '11:00', '11:30')], []);
  const laid = layoutTimeline(items, 8, 60);
  it('places overlapping items side by side', () => {
    expect(laid.find((p) => p.id === 'a')).toMatchObject({ top: 60, height: 60, col: 0, cols: 2 });
    expect(laid.find((p) => p.id === 'b')).toMatchObject({ top: 90, col: 1, cols: 2 });
  });
  it('gives non-overlapping items the full width', () => {
    expect(laid.find((p) => p.id === 'c')).toMatchObject({ col: 0, cols: 1 });
  });
  it('stretches the hour range to fit', () => {
    expect(hourRange(mergeItems([ev('early', '2026-09-24', '06:15', '07:00')], []))).toEqual([6, 21]);
  });
});

describe('scheduleStatus', () => {
  const timed = mergeItems([ev('a', '2026-09-24', '09:00', '10:00'), ev('b', '2026-09-24', '10:30', '11:00')], []);
  it('finds the current and next item', () => {
    expect(scheduleStatus(timed, 9 * 60 + 15)).toEqual({ currentId: 'a', nextId: 'b', nextIn: 75 });
    expect(scheduleStatus(timed, 12 * 60)).toEqual({ currentId: undefined, nextId: undefined, nextIn: undefined });
  });
});

describe('moveSlot', () => {
  it('snaps to 15 minutes and keeps the length', () => {
    expect(moveSlot('09:00', '10:00', 38)).toEqual({ start: '09:45', end: '10:45' });
    expect(moveSlot('09:00', '09:30', -58)).toEqual({ start: '08:00', end: '08:30' });
  });
  it('stays inside the day', () => {
    expect(moveSlot('01:00', '02:00', -300)).toEqual({ start: '00:00', end: '01:00' });
    expect(moveSlot('22:00', '23:00', 300)).toEqual({ start: '23:00', end: '23:59' });
    expect(moveSlot('22:00', '22:15', 300)).toEqual({ start: '23:45', end: '23:59' });
  });
});
