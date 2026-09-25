import { describe, expect, it } from 'vitest';

import { detectIntent, freeSlots, matchScore, respond } from '../engine';
import type { AssistantContext } from '../types';

const t = (key: string) => key;
const now = new Date(2026, 8, 24, 10, 5);

const ctx = (over: Partial<AssistantContext> = {}): AssistantContext => ({
  now,
  name: 'Proud',
  currency: 'THB',
  tasks: [
    { id: 'late', title: 'Send engagement letter', date: '2026-09-23', startTime: null, endTime: null, isDone: false, priority: 1 },
    { id: 'vat', title: 'Prepare VAT reconciliation', date: '2026-09-24', startTime: null, endTime: null, isDone: false, priority: 1 },
    { id: 'cima', title: 'Review CIMA notes', date: '2026-09-24', startTime: null, endTime: null, isDone: false, priority: 2 },
    { id: 'reply', title: 'Reply to client', date: '2026-09-24', startTime: '16:00', endTime: null, isDone: false, priority: 2 },
  ],
  events: [
    { id: 'e1', title: 'Team meeting', date: '2026-09-24', start: '09:00', end: '10:00', allDay: false },
    { id: 'e2', title: 'Client call', date: '2026-09-24', start: '10:30', end: '11:15', allDay: false },
    { id: 'e3', title: 'Focus', date: '2026-09-24', start: '13:00', end: '15:00', allDay: false },
  ],
  bills: [
    { id: 'b1', name: 'Council Tax', amount: 142, currency: 'GBP', due: '2026-09-24', state: 'today' },
    { id: 'b2', name: 'Netflix', amount: 419, currency: 'THB', due: '2026-10-16', state: 'later' },
  ],
  money: { income: 45000, expense: 9000, categories: [{ name: 'Food', spent: 3950, budget: 8000 }, { name: 'Shopping', spent: 5200, budget: 5000 }] },
  ...over,
});

describe('detectIntent', () => {
  it.each([
    ['Plan my day', 'plan_day'],
    ['วางแผนวันนี้', 'plan_day'],
    ['Find overdue tasks', 'overdue'],
    ['Review my expenses', 'expenses'],
    ['ใช้เงินไปเท่าไหร่', 'expenses'],
    ['any bills due?', 'bills'],
    ['Summarise my tasks', 'summarise_tasks'],
    ['Summarise emails', 'emails'],
    ['hello', 'greeting'],
    ['what can you do', 'help'],
    ['lunch 180', 'capture'],
    ['blue sky thinking', 'unknown'],
  ])('%s → %s', (text, intent) => {
    expect(detectIntent(text, ctx()).intent).toBe(intent);
  });
  it('extracts the task to complete', () => {
    expect(detectIntent('mark VAT reconciliation as done')).toEqual({ intent: 'complete', target: 'VAT reconciliation' });
    expect(detectIntent('ส่งเอกสารเสร็จแล้ว')).toEqual({ intent: 'complete', target: 'ส่งเอกสาร' });
  });
});

describe('freeSlots', () => {
  it('finds gaps between busy blocks inside working hours', () => {
    const busy = [{ start: 540, end: 600 }, { start: 630, end: 675 }, { start: 780, end: 900 }];
    expect(freeSlots(busy, 605)).toEqual([
      { start: 675, end: 780 },
      { start: 900, end: 1080 },
    ]);
  });
});

describe('respond', () => {
  it('plans the day as one approvable card: overdue and high-priority tasks first, into the free gaps', () => {
    const r = respond('plan my day', ctx(), t);
    expect(r.text).toBe('assistant.r.plan_slots');
    expect(r.cards.map((c) => c.type)).toEqual(['list', 'proposal']);
    const card = r.cards[1];
    expect(card).toMatchObject({ type: 'proposal', state: 'pending', proposal: { kind: 'apply_plan', date: '2026-09-24' } });
    const plan = card.type === 'proposal' && card.proposal.kind === 'apply_plan' ? card.proposal : null;
    expect(plan?.slots.map((s) => [s.taskId, s.startTime, s.endTime])).toEqual([
      ['late', '11:15', '12:00'], // overdue, priority 1 — first gap after the 10:30 call
      ['vat', '12:00', '12:45'],
      ['cima', '15:00', '15:45'], // 12:45–13:00 is too short; next gap after the focus block
    ]);
    expect(plan?.slots[0]).toMatchObject({ title: 'Send engagement letter', overdue: true });
  });
  it('offers to move overdue tasks to today', () => {
    const r = respond('overdue', ctx(), t);
    expect(r.cards).toHaveLength(1);
    expect(r.cards[0]).toMatchObject({ proposal: { kind: 'reschedule_task', taskId: 'late', date: '2026-09-24' } });
  });
  it('flags over-budget categories', () => {
    const r = respond('review my expenses', ctx(), t);
    expect(r.text).toBe('assistant.r.expenses_over');
  });
  it('lists bills and offers to pay the ones due today', () => {
    const r = respond('bills', ctx(), t);
    expect(r.cards.map((c) => c.type)).toEqual(['list', 'proposal']);
  });
  it('proposes completing the best-matching task', () => {
    const r = respond('mark VAT reconciliation as done', ctx(), t);
    expect(r.cards).toEqual([expect.objectContaining({ proposal: { kind: 'complete_task', taskId: 'vat', title: 'Prepare VAT reconciliation' } })]);
  });
  it('turns capturable text into a create proposal', () => {
    const r = respond('Meeting with John tomorrow at 10', ctx(), t);
    expect(r.cards[0]).toMatchObject({ type: 'proposal', proposal: { kind: 'create' } });
  });
  it('says the day is clear when there is nothing', () => {
    expect(respond('plan my day', ctx({ tasks: [], events: [] }), t).text).toBe('assistant.r.plan_clear');
  });
});

describe('matchScore', () => {
  it('prefers substring matches over word overlap', () => {
    expect(matchScore('vat reconciliation', 'Prepare VAT reconciliation')).toBeGreaterThan(matchScore('vat report', 'Prepare VAT reconciliation'));
    expect(matchScore('xyz', 'Prepare VAT')).toBe(0);
  });
});
