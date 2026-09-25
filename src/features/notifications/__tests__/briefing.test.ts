import { describe, expect, it } from 'vitest';

import { briefingBody, briefingTimes } from '../briefing-model';

const t = (key: string, opts?: Record<string, unknown>) => {
  const k = key.replace(/^(home|review)\./, '');
  if (k === 'list_sep') return ', ';
  if (k === 'list_and') return ' and ';
  return `${k}${opts ? ` ${JSON.stringify(opts)}` : ''}`;
};

describe('briefingTimes', () => {
  it('starts today when the time is still ahead, else tomorrow, and returns 7 mornings', () => {
    const early = new Date(2026, 8, 25, 6, 0);
    const late = new Date(2026, 8, 25, 9, 0);
    const a = briefingTimes(7, 30, 7, early);
    const b = briefingTimes(7, 30, 7, late);
    expect(a).toHaveLength(7);
    expect(a[0]).toEqual({ date: '2026-09-25', at: new Date(2026, 8, 25, 7, 30).getTime() });
    expect(b[0].date).toBe('2026-09-26');
    expect(b[6].date).toBe('2026-10-02');
  });
});

describe('briefingBody', () => {
  it('joins the counts and adds the first event', () => {
    expect(briefingBody(t, { events: 2, tasks: 3, overdue: 0, bills: 1, firstEvent: { title: 'VAT call', start: '10:00' } })).toBe(
      'part_events {"count":2}, part_tasks {"count":3} and part_bills {"count":1} · briefing_first {"title":"VAT call","time":"10:00"}',
    );
  });
  it('mentions overdue work ahead of the first event, and a clear day when empty', () => {
    expect(briefingBody(t, { events: 1, tasks: 0, overdue: 2, bills: 0, firstEvent: { title: 'x', start: '09:00' } })).toBe('part_events {"count":1} · briefing_overdue {"count":2}');
    expect(briefingBody(t, { events: 0, tasks: 0, overdue: 0, bills: 0 })).toBe('briefing_nothing');
  });
});
