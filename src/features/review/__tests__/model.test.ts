import { describe, expect, it } from 'vitest';

import type { SummaryRequest } from '@/features/ai/summary';

import { buildSummaryRequest, localSummary, summaryRange, type SummarySource } from '../model';

const t = (key: string, opts?: Record<string, unknown>) => `${key.replace('review.', '')}${opts ? ` ${JSON.stringify(opts)}` : ''}`;
const now = new Date(2026, 8, 25, 9, 0); // Friday 25 Sep 2026

const src = (over: Partial<SummarySource> = {}): SummarySource => ({
  scope: 'day',
  locale: 'en',
  name: 'Proud',
  currency: 'THB',
  now,
  tasks: [
    { title: 'VAT recon', date: '2026-09-25', startTime: '14:00', isDone: false, doneAt: null, priority: 1 },
    { title: 'Late one', date: '2026-09-20', startTime: null, isDone: false, doneAt: null, priority: 2 },
    { title: 'Next week', date: '2026-10-01', startTime: null, isDone: false, doneAt: null, priority: 2 },
    { title: 'Undated done today', date: null, startTime: null, isDone: true, doneAt: now.getTime() - 3600_000, priority: 2 },
    { title: 'Someday', date: null, startTime: null, isDone: false, doneAt: null, priority: 3 },
  ],
  events: [
    { title: 'Meeting with John', date: '2026-09-25', start: '10:00', end: '11:00', allDay: false },
    { title: 'Monday call', date: '2026-09-21', start: '09:00', end: '09:30', allDay: false },
  ],
  bills: [
    { name: 'Rent', amount: 12000, currency: 'THB', due: '2026-09-25', state: 'today', days: 0 },
    { name: 'Netflix', amount: 419, currency: 'THB', due: '2026-10-15', state: 'later', days: 20 },
  ],
  transactions: [
    { amount: 120, currency: 'THB', type: 'expense', date: '2026-09-25', categoryId: 'food' },
    { amount: 5000, currency: 'GBP', type: 'income', date: '2026-09-25', categoryId: null },
    { amount: 900, currency: 'THB', type: 'expense', date: '2026-09-22', categoryId: 'food' },
  ],
  categories: [{ id: 'food', name: 'Food', type: 'expense', budgetMonthly: 1000 }],
  checkins: [{ date: '2026-09-25', mood: 4, energy: 3, reflection: null }],
  ...over,
});

describe('summaryRange', () => {
  it('day is today, week is Monday to Sunday', () => {
    expect(summaryRange('day', now)).toEqual({ from: '2026-09-25', to: '2026-09-25' });
    expect(summaryRange('week', now)).toEqual({ from: '2026-09-21', to: '2026-09-27' });
    expect(summaryRange('week', new Date(2026, 8, 27))).toEqual({ from: '2026-09-21', to: '2026-09-27' }); // Sunday stays in its week
  });
});

describe('buildSummaryRequest', () => {
  it('day: keeps today, overdue and done-today rows only; money in the primary currency', () => {
    const req = buildSummaryRequest(src());
    expect(req.tasks.map((x) => [x.title, x.overdue])).toEqual([
      ['Late one', true],
      ['VAT recon', false],
      ['Undated done today', false],
    ]);
    expect(req.events.map((e) => e.title)).toEqual(['Meeting with John']);
    expect(req.bills.map((b) => b.name)).toEqual(['Rent']);
    expect(req.money).toEqual({ income: 0, expense: 120, currency: 'THB', topCategories: [{ name: 'Food', total: 120 }], overBudget: [{ name: 'Food', spent: 1020, budget: 1000 }] });
    expect(req.checkins).toHaveLength(1);
    expect(req).toMatchObject({ scope: 'day', today: '2026-09-25', weekday: 'Friday', from: '2026-09-25', to: '2026-09-25', locale: 'en', name: 'Proud' });
  });

  it('week: widens to the whole week', () => {
    const req = buildSummaryRequest(src({ scope: 'week' }));
    expect(req.events.map((e) => e.title)).toEqual(['Meeting with John', 'Monday call']);
    expect(req.money.expense).toBe(1020);
  });
});

describe('localSummary', () => {
  const base = (over: Partial<SummaryRequest> = {}): SummaryRequest => ({ ...buildSummaryRequest(src()), ...over });

  it('leads with overdue work and lists bills and priorities', () => {
    const out = localSummary(base(), t);
    expect(out.headline).toBe('local_headline_overdue {"count":1}');
    expect(out.needsAttention).toEqual(['local_overdue {"title":"Late one"}', 'local_bill {"name":"Rent","amount":"12,000","currency":"THB"}', 'local_high {"title":"VAT recon"}', 'local_over_budget {"name":"Food"}']);
    expect(out.highlights[0]).toBe('local_done {"title":"Undated done today"}');
    expect(out.summary).toContain('local_first_event {"title":"Meeting with John","time":"10:00"}');
  });

  it('is calm when there is nothing to do', () => {
    const out = localSummary(base({ tasks: [], events: [], bills: [], money: { income: 0, expense: 0, currency: 'THB', topCategories: [], overBudget: [] } }), t);
    expect(out.headline).toBe('local_headline_clear');
    expect(out.needsAttention).toEqual([]);
    expect(out.highlights).toEqual(['local_free_day']);
  });
});
