import { describe, expect, it } from 'vitest';

import { attentionTasks, groupTasks, isValidDate, isValidTime, priorityLevel, todayProgress } from '../model';

const today = '2026-09-24';
let n = 0;
const task = (over: Partial<{ id: string; date: string | null; startTime: string | null; isDone: boolean; priority: number; doneAt: number | null }>) => ({
  id: `t${n++}`,
  date: null,
  startTime: null,
  isDone: false,
  priority: 2,
  sortOrder: 0,
  doneAt: null,
  createdAt: n,
  ...over,
});

const tasks = [
  task({ id: 'late', date: '2026-09-23' }),
  task({ id: 'pm', date: today, startTime: '15:00' }),
  task({ id: 'am', date: today, startTime: '09:00' }),
  task({ id: 'urgent', date: today, priority: 1 }),
  task({ id: 'next', date: '2026-09-26' }),
  task({ id: 'someday' }),
  task({ id: 'finished', date: today, isDone: true, doneAt: 5 }),
];
const ids = (xs: { id: string }[]) => xs.map((x) => x.id);

describe('groupTasks', () => {
  it('buckets open tasks by time for "all"', () => {
    const s = groupTasks(tasks, today, 'all');
    expect(s.map((x) => x.key)).toEqual(['overdue', 'today', 'upcoming', 'anytime']);
    expect(ids(s[1].tasks)).toEqual(['am', 'pm', 'urgent']);
  });
  it('today filter keeps overdue visible', () => {
    expect(groupTasks(tasks, today, 'today').map((x) => x.key)).toEqual(['overdue', 'today']);
  });
  it('done filter only lists completed tasks', () => {
    expect(ids(groupTasks(tasks, today, 'done')[0].tasks)).toEqual(['finished']);
  });
  it('drops empty sections', () => {
    expect(groupTasks([], today, 'all')).toEqual([]);
  });
});

describe('todayProgress', () => {
  it('counts only tasks dated today', () => {
    expect(todayProgress(tasks, today)).toEqual({ done: 1, total: 4, ratio: 0.25 });
  });
});

describe('attentionTasks', () => {
  it('puts overdue first, then high priority', () => {
    expect(ids(attentionTasks(tasks, today))).toEqual(['late', 'urgent', 'am']);
  });
});

describe('helpers', () => {
  it('maps priority', () => {
    expect([1, 2, 3].map(priorityLevel)).toEqual(['high', 'medium', 'low']);
  });
  it('validates time and date', () => {
    expect([isValidTime('09:30'), isValidTime('24:00'), isValidTime('9:30')]).toEqual([true, false, false]);
    expect([isValidDate('2026-09-24'), isValidDate('2026-13-01')]).toEqual([true, false]);
    expect([isValidDate('2026-02-30'), isValidDate('2026-02-28'), isValidDate('2028-02-29'), isValidDate('2026-04-31')]).toEqual([false, true, true, false]);
  });
});
