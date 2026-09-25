import { describe, expect, it } from 'vitest';

import { followUpTask, mergeInbox, waitingDays } from '../model';

const thread = (id: string, lastAt: number) => ({ id, subject: id, from: { name: null, email: 'a@b.com' }, snippet: '', lastAt, messageCount: 1, unread: false });

describe('mergeInbox', () => {
  it('flattens accounts newest first and skips accounts without threads', () => {
    const rows = mergeInbox([
      { id: 'A', email: 'a@x.com', status: 'ok', threads: [thread('t1', 100), thread('t3', 300)] },
      { id: 'B', email: 'b@x.com', status: 'scope' },
      { id: 'C', email: 'c@x.com', status: 'ok', threads: [thread('t2', 200)] },
    ]);
    expect(rows.map((r) => `${r.accountId}/${r.id}`)).toEqual(['A/t3', 'C/t2', 'A/t1']);
    expect(rows[1].accountEmail).toBe('c@x.com');
  });
});

describe('waitingDays', () => {
  it('counts whole days', () => {
    const now = Date.UTC(2026, 8, 25, 12);
    expect(waitingDays(now - 3_600_000, now)).toBe(0);
    expect(waitingDays(now - 3 * 86_400_000 - 1, now)).toBe(3);
    expect(waitingDays(now + 1000, now)).toBe(0);
  });
});

describe('followUpTask', () => {
  it('schedules a 09:00 reminder N days out', () => {
    const v = followUpTask({ subject: 'VAT Q3', from: { name: 'John', email: 'john@c.uk' }, accountEmail: 'me@x.com' }, 3, 'Follow up: VAT Q3', new Date(2026, 8, 29, 18));
    expect(v).toMatchObject({ title: 'Follow up: VAT Q3', date: '2026-10-02', startTime: '09:00', remind: true, isDone: false });
    expect(v.notes).toContain('John <john@c.uk>');
  });
});
