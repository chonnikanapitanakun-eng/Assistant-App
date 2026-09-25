import { describe, expect, it } from 'vitest';

import { PLAN_SCHEMA, normalizePlanRequest, normalizePlanResponse, planLocally, planWindow, type PlanRequest } from '../../../../supabase/functions/_shared/plan-contract';

const req: PlanRequest = {
  locale: 'en',
  date: '2026-09-24',
  weekday: 'Thursday',
  now: '10:05',
  workStart: '09:00',
  workEnd: '18:00',
  busy: [
    { kind: 'event', title: 'Team meeting', start: '09:00', end: '10:00' },
    { kind: 'event', title: 'Client call', start: '10:30', end: '11:15' },
    { kind: 'task', title: 'Reply to client', start: '16:00', end: '16:30' },
  ],
  backlog: [
    { id: 'late', title: 'Send engagement letter', priority: 1, durationMin: null, energy: null, date: '2026-09-23', overdue: true },
    { id: 'vat', title: 'Prepare VAT reconciliation', priority: 1, durationMin: 90, energy: 'high', date: '2026-09-24', overdue: false },
    { id: 'cima', title: 'Review CIMA notes', priority: 2, durationMin: 30, energy: 'low', date: '2026-09-24', overdue: false },
  ],
  energyPattern: null,
};

describe('ai-plan contract', () => {
  it('schema is strict: every property is required and no extras allowed', () => {
    const slot = PLAN_SCHEMA.properties.schedule.items;
    expect(slot.required).toEqual(Object.keys(slot.properties));
    expect(slot.additionalProperties).toBe(false);
    expect(PLAN_SCHEMA.required).toEqual(['schedule', 'skipped', 'summary']);
  });

  it('plans from now (rounded up to 15 min) on the planned day, and from the window start otherwise', () => {
    expect(planWindow(req)).toEqual({ start: 540, end: 1080, from: 615 });
    expect(planWindow({ ...req, now: null })).toEqual({ start: 540, end: 1080, from: 540 });
  });

  it('cleans the request: drops rows without id/title, clamps durations, defaults the window', () => {
    const r = normalizePlanRequest({
      date: '2026-09-24',
      backlog: [{ id: 'a', title: 'A', priority: 9, durationMin: 5000 }, { id: '', title: 'no id' }, { id: 'b', title: 'B', energy: 'high', overdue: true }],
      busy: [{ start: '10:00', end: '09:00', title: 'inverted' }, { start: '12:00', end: '13:00', title: 'lunch' }],
    });
    expect(r).toMatchObject({ locale: 'en', workStart: '09:00', workEnd: '18:00', now: null });
    expect(r?.backlog).toEqual([
      { id: 'a', title: 'A', priority: 2, durationMin: 240, energy: null, date: null, overdue: false },
      { id: 'b', title: 'B', priority: 2, durationMin: null, energy: 'high', date: null, overdue: true },
    ]);
    expect(r?.busy).toEqual([{ kind: 'event', title: 'lunch', start: '12:00', end: '13:00' }]);
    expect(normalizePlanRequest({ backlog: [] })).toBeNull();
  });

  it('keeps only valid, non-overlapping blocks for known tasks', () => {
    const out = normalizePlanResponse(
      {
        schedule: [
          { taskId: 'vat', startTime: '11:15', endTime: '12:45', reason: 'deep work after the call' },
          { taskId: 'ghost', startTime: '13:00', endTime: '13:30', reason: 'unknown task' },
          { taskId: 'late', startTime: '10:00', endTime: '10:30', reason: 'before now' },
          { taskId: 'late', startTime: '12:30', endTime: '13:00', reason: 'overlaps vat' },
          { taskId: 'late', startTime: '13:00', endTime: '13:30', reason: 'ok' },
          { taskId: 'late', startTime: '14:00', endTime: '14:30', reason: 'duplicate task' },
          { taskId: 'cima', startTime: '16:15', endTime: '16:45', reason: 'overlaps the 16:00 task' },
          { taskId: 'cima', startTime: '17:45', endTime: '18:15', reason: 'past the window' },
        ],
        skipped: [{ taskId: 'cima', reason: 'no room' }, { taskId: 'late', reason: 'already placed' }, { taskId: 'nope', reason: 'unknown' }],
        summary: '  Two meetings, focus block before lunch.  ',
      },
      req,
    );
    expect(out.schedule).toEqual([
      { taskId: 'vat', startTime: '11:15', endTime: '12:45', reason: 'deep work after the call' },
      { taskId: 'late', startTime: '13:00', endTime: '13:30', reason: 'ok' },
    ]);
    expect(out.skipped).toEqual([{ taskId: 'cima', reason: 'no room' }]);
    expect(out.summary).toBe('Two meetings, focus block before lunch.');
  });

  it('never throws on garbage', () => {
    expect(normalizePlanResponse(null, req)).toEqual({ schedule: [], skipped: [], summary: '' });
    expect(normalizePlanResponse({ schedule: 'x', skipped: [null], summary: 3 }, req)).toEqual({ schedule: [], skipped: [], summary: '' });
  });
});

describe('planLocally', () => {
  it('places overdue and priority-1 tasks first, using their duration estimates', () => {
    const out = planLocally(req);
    expect(out.schedule).toEqual([
      { taskId: 'late', startTime: '11:15', endTime: '12:00', reason: '' }, // default 45 min
      { taskId: 'vat', startTime: '12:00', endTime: '13:30', reason: '' }, // 90 min
      { taskId: 'cima', startTime: '13:30', endTime: '14:00', reason: '' }, // 30 min
    ]);
    expect(out.skipped).toEqual([]);
    // Its own output passes the same validation the model's output goes through.
    expect(normalizePlanResponse(out, req).schedule).toEqual(out.schedule);
  });

  it('shortens a block into a slightly tight gap, but skips when a gap covers under 60% of the estimate', () => {
    const late: PlanRequest = { ...req, now: '17:00', busy: [] }; // one 60-minute gap left
    expect(planLocally({ ...late, backlog: [req.backlog[1]] }).schedule).toEqual([{ taskId: 'vat', startTime: '17:00', endTime: '18:00', reason: '' }]); // 90 → 60 min
    const out = planLocally(late);
    expect(out.schedule.map((s) => [s.taskId, s.startTime, s.endTime])).toEqual([['late', '17:00', '17:45']]);
    expect(out.skipped).toEqual([{ taskId: 'vat', reason: '' }, { taskId: 'cima', reason: '' }]); // 15 min left: too short for 90 or 30
  });

  it('stops at maxSlots and reports the rest as skipped', () => {
    expect(planLocally(req, 1)).toMatchObject({ schedule: [{ taskId: 'late' }], skipped: [{ taskId: 'vat' }, { taskId: 'cima' }] });
  });
});
