import { describe, expect, it } from 'vitest';

import { buildTimeline, buildWidgetData, dueBill, entryAt, nextItem, timelineTimes, type WidgetInput, type WidgetStrings } from '../model';

const at = (hhmm: string, day = 24) => new Date(2026, 8, day, Number(hhmm.slice(0, 2)), Number(hhmm.slice(3))).getTime();

const s: WidgetStrings = {
  nextLabel: 'Next up',
  emptyLabel: 'Free',
  progress: (d, t) => `${d}/${t}`,
  billDue: (days) => `in ${days}`,
  capture: 'Capture',
  money: (a, c) => `${c} ${a}`,
  time: (ms) => new Date(ms).toTimeString().slice(0, 5),
};

const task = (over: Partial<WidgetInput['tasks'][number]>): WidgetInput['tasks'][number] => ({ id: 't', title: 'Task', date: '2026-09-24', startTime: null, endTime: null, isDone: false, ...over });
const bill = (over: Partial<WidgetInput['bills'][number]>): WidgetInput['bills'][number] => ({
  id: 'b',
  name: 'Rent',
  amount: 1200,
  currency: 'THB',
  dueDay: 26,
  dueMonth: null,
  frequency: 'monthly',
  paidThrough: null,
  remindDaysBefore: 3,
  ...over,
});

const input: WidgetInput = {
  tasks: [
    task({ id: 'am', title: 'Standup', startTime: '09:00', endTime: '09:15', isDone: true }),
    task({ id: 'vat', title: 'VAT recon', startTime: '13:00', endTime: '14:00' }),
    task({ id: 'any', title: 'Anytime' }),
    task({ id: 'tmr', title: 'Tomorrow', date: '2026-09-25', startTime: '08:00' }),
  ],
  events: [
    { id: 'e1', title: 'Meet John', start: at('15:00'), end: at('16:00'), isAllDay: false },
    { id: 'hol', title: 'Holiday', start: at('00:00'), end: at('00:00', 25), isAllDay: true },
  ],
  bills: [bill({})],
};

describe('nextItem', () => {
  it('picks the current item, then the next one, skipping done tasks and all-day events', () => {
    expect(nextItem(input, at('08:00'))?.id).toBe('vat');
    expect(nextItem(input, at('13:30'))?.id).toBe('vat');
    expect(nextItem(input, at('14:00'))?.id).toBe('e1');
    expect(nextItem(input, at('16:00'))).toBeNull();
  });

  it("uses tomorrow's items after midnight", () => {
    expect(nextItem(input, at('00:00', 25))?.id).toBe('tmr');
  });
});

describe('dueBill', () => {
  it('finds the soonest bill within a week, including overdue ones', () => {
    expect(dueBill(input, at('09:00'))?.days).toBe(2);
    expect(dueBill({ ...input, bills: [bill({ dueDay: 10 })] }, at('09:00'))?.days).toBe(-14);
    expect(dueBill({ ...input, bills: [bill({ dueDay: 26, paidThrough: '2026-09-26' })] }, at('09:00'))).toBeNull();
  });
});

describe('buildWidgetData', () => {
  it('fills text and deep links', () => {
    const d = buildWidgetData(input, at('10:00'), s);
    expect(d).toMatchObject({ nextTitle: 'VAT recon', nextTime: '13:00 – 14:00', done: 1, total: 3, progressLabel: '1/3', billName: 'Rent', billDetail: 'in 2 · THB 1200' });
    expect(d.nextUrl).toBe('veyra://task/vat');
    expect(d.billUrl).toBe('veyra://bill/b');
    expect(d.captureUrl).toBe('veyra://capture');
  });

  it('falls back when the day is free and no bill is due', () => {
    const d = buildWidgetData({ ...input, bills: [] }, at('17:00'), s);
    expect(d.nextTitle).toBe('');
    expect(d.nextUrl).toBe('veyra://calendar');
    expect(d.billName).toBe('');
  });
});

describe('timeline', () => {
  it('has an entry now, at each start/end still ahead, and at midnight', () => {
    expect(timelineTimes(input, at('13:30'))).toEqual([at('13:30'), at('14:00'), at('15:00'), at('16:00'), at('00:00', 25)]);
  });

  it('advances the next item as time passes', () => {
    const entries = buildTimeline(input, at('10:00'), s);
    expect(entryAt(entries, at('14:30'))?.data.nextTitle).toBe('Meet John');
    expect(entryAt(entries, at('16:30'))?.data.nextTitle).toBe('');
    expect(entryAt(entries, at('09:00'))?.at).toBe(at('10:00'));
  });
});
