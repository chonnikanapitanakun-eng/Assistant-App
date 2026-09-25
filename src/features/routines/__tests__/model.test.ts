import { describe, expect, it } from 'vitest';

import { occursOn, routinesDue, routineTaskId, ruleDays, ruleKind, sortRoutines, taskFromRoutine, toRule, weekday } from '../model';

// 2026-09-25 is a Friday, 2026-09-27 a Sunday.
const FRI = '2026-09-25';
const SUN = '2026-09-27';

describe('rules', () => {
  it('parses daily and weekly rules', () => {
    expect(ruleDays('daily')).toEqual([0, 1, 2, 3, 4, 5, 6]);
    expect(ruleDays('weekly:5,1,3,1')).toEqual([1, 3, 5]);
  });

  it('treats unknown rules as never', () => {
    expect(ruleDays('weekly:')).toEqual([]);
    expect(ruleDays('weekly:7')).toEqual([]);
    expect(ruleDays('FREQ=DAILY')).toEqual([]);
    expect(ruleKind('nope')).toBe('never');
  });

  it('round-trips through toRule and collapses every day to daily', () => {
    expect(toRule([5, 1, 3])).toBe('weekly:1,3,5');
    expect(toRule([0, 1, 2, 3, 4, 5, 6])).toBe('daily');
    expect(ruleDays(toRule([6, 0]))).toEqual([0, 6]);
  });

  it('names common shapes', () => {
    expect(ruleKind('daily')).toBe('daily');
    expect(ruleKind('weekly:1,2,3,4,5')).toBe('weekdays');
    expect(ruleKind('weekly:0,6')).toBe('weekends');
    expect(ruleKind('weekly:2,4')).toBe('custom');
  });

  it('checks the day of week from a local date key', () => {
    expect(weekday(FRI)).toBe(5);
    expect(weekday(SUN)).toBe(0);
    expect(occursOn('weekly:1,2,3,4,5', FRI)).toBe(true);
    expect(occursOn('weekly:1,2,3,4,5', SUN)).toBe(false);
    expect(occursOn('daily', SUN)).toBe(true);
  });
});

describe('routinesDue', () => {
  const r = (id: string, rule: string, over: { active?: boolean; deletedAt?: number | null } = {}) => ({ id, rule, active: true, deletedAt: null, ...over });

  it('keeps active routines that run today and have no task yet', () => {
    const list = [r('a', 'daily'), r('b', 'weekly:0,6'), r('c', 'daily', { active: false }), r('d', 'daily', { deletedAt: 1 }), r('e', 'daily')];
    expect(routinesDue(list, FRI, new Set(['e'])).map((x) => x.id)).toEqual(['a']);
    expect(routinesDue(list, SUN, new Set()).map((x) => x.id)).toEqual(['a', 'b', 'e']);
  });
});

describe('taskFromRoutine', () => {
  let n = 0;
  const id = () => `id${n++}`;

  it('copies the template and turns steps into a checklist', () => {
    const task = taskFromRoutine(
      { id: 'r1', title: 'Morning routine', areaId: 'health', template: { startTime: '07:00', endTime: '07:30', energy: 'low', steps: [' Stretch ', '', 'Water'] } },
      FRI,
      id,
    );
    expect(task).toEqual({
      title: 'Morning routine',
      date: FRI,
      startTime: '07:00',
      endTime: '07:30',
      energy: 'low',
      areaId: 'health',
      routineId: 'r1',
      checklist: [
        { id: 'id0', text: 'Stretch', done: false },
        { id: 'id1', text: 'Water', done: false },
      ],
    });
  });

  it('handles an empty template and drops an end time without a start', () => {
    const task = taskFromRoutine({ id: 'r2', title: 'Read', areaId: null, template: { endTime: '22:00' } }, FRI, id);
    expect(task).toMatchObject({ startTime: null, endTime: null, energy: null, checklist: null });
    expect(taskFromRoutine({ id: 'r3', title: 'X', areaId: null, template: null }, FRI, id).checklist).toBeNull();
  });
});

describe('routineTaskId', () => {
  it('is the same for a routine and day on every device, and differs across days', () => {
    expect(routineTaskId('r1', FRI)).toBe(routineTaskId('r1', FRI));
    expect(routineTaskId('r1', FRI)).not.toBe(routineTaskId('r1', '2026-09-26'));
    expect(routineTaskId('r1', FRI)).not.toBe(routineTaskId('r2', FRI));
  });
});

describe('sortRoutines', () => {
  it('orders by period, then start time, then title', () => {
    const list = [
      { title: 'Night', period: 'night' as const, template: null },
      { title: 'Loose', period: null, template: null },
      { title: 'B', period: 'morning' as const, template: { startTime: '07:00' } },
      { title: 'A', period: 'morning' as const, template: { startTime: '08:00' } },
      { title: 'Lunch', period: 'day' as const, template: null },
    ];
    expect(sortRoutines(list).map((x) => x.title)).toEqual(['B', 'A', 'Lunch', 'Night', 'Loose']);
  });
});
