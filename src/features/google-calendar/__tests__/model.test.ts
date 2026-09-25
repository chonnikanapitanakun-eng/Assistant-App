import { describe, expect, it } from 'vitest';

import { ACCOUNT_COLORS, pickColor, planSync, syncWindow, toRange, type ExistingEvent } from '../model';
import type { RemoteEvent, SyncAccount } from '../types';

const local = (d: string, t = '00:00') => new Date(`${d}T${t}:00`).getTime();
const window = { from: local('2026-09-01'), to: local('2026-12-31') };

const ev = (id: string, over: Partial<RemoteEvent> = {}): RemoteEvent => ({
  id,
  iCalUID: `${id}@google.com`,
  calendarName: 'Work',
  title: id,
  location: null,
  start: { dateTime: '2026-09-25T09:00:00+07:00' },
  end: { dateTime: '2026-09-25T10:00:00+07:00' },
  ...over,
});
const acct = (id: string, events: RemoteEvent[], status: SyncAccount['status'] = 'ok'): SyncAccount => ({ id, email: `${id}@gmail.com`, status, events });

function existingFrom(accountId: string, e: RemoteEvent, id: string, deletedAt: number | null = null): ExistingEvent {
  const r = toRange(e.start, e.end)!;
  return { id, accountId, externalId: e.id, calendarName: e.calendarName, title: e.title, location: e.location, deletedAt, ...r };
}

describe('toRange', () => {
  it('parses timed events with their offset', () => {
    expect(toRange({ dateTime: '2026-09-25T09:00:00+07:00' }, { dateTime: '2026-09-25T10:30:00+07:00' })).toEqual({
      start: Date.parse('2026-09-25T02:00:00Z'),
      end: Date.parse('2026-09-25T03:30:00Z'),
      isAllDay: false,
    });
  });
  it('stores all-day events at local midnight with Google’s exclusive end', () => {
    expect(toRange({ date: '2026-09-25' }, { date: '2026-09-26' })).toEqual({ start: local('2026-09-25'), end: local('2026-09-26'), isAllDay: true });
  });
  it('gives a zero-length or missing end 30 minutes and rejects bad input', () => {
    const r = toRange({ dateTime: '2026-09-25T09:00:00Z' }, { dateTime: '2026-09-25T09:00:00Z' })!;
    expect(r.end - r.start).toBe(30 * 60_000);
    expect(toRange({}, {})).toBeNull();
  });
});

describe('planSync', () => {
  it('inserts new events for each linked account', () => {
    const plan = planSync([acct('a', [ev('1')]), acct('b', [ev('2')])], [], window);
    expect(plan.insert.map((i) => [i.accountId, i.externalId])).toEqual([['a', '1'], ['b', '2']]);
    expect(plan.update).toEqual([]);
    expect(plan.remove).toEqual([]);
  });

  it('keeps local ids: unchanged rows are left alone, changed ones updated', () => {
    const e1 = ev('1');
    const e2 = ev('2');
    const plan = planSync([acct('a', [e1, { ...e2, title: 'Renamed' }])], [existingFrom('a', e1, 'L1'), existingFrom('a', e2, 'L2')], window);
    expect(plan.insert).toEqual([]);
    expect(plan.update).toEqual([{ id: 'L2', values: expect.objectContaining({ title: 'Renamed' }) }]);
  });

  it('removes events deleted in Google, and brings back ones that reappear', () => {
    const gone = ev('gone');
    const back = ev('back');
    const plan = planSync([acct('a', [back])], [existingFrom('a', gone, 'L1'), existingFrom('a', back, 'L2', 123)], window);
    expect(plan.remove).toEqual(['L1']);
    expect(plan.update).toEqual([{ id: 'L2', values: expect.objectContaining({ externalId: 'back' }) }]);
  });

  it('leaves accounts that need re-linking or failed untouched', () => {
    const e = ev('1');
    const plan = planSync([acct('a', [], 'reauth'), acct('b', [], 'error')], [existingFrom('a', e, 'L1'), existingFrom('b', e, 'L2')], window);
    expect(plan).toEqual({ insert: [], update: [], remove: [] });
  });

  it('only removes inside the synced window', () => {
    const old = ev('old', { start: { dateTime: '2026-06-01T09:00:00Z' }, end: { dateTime: '2026-06-01T10:00:00Z' } });
    expect(planSync([acct('a', [])], [existingFrom('a', old, 'L1')], window).remove).toEqual([]);
  });

  it('shows an invite shared by two linked accounts once', () => {
    const shared = ev('x', { iCalUID: 'meeting@corp' });
    const plan = planSync([acct('a', [shared]), acct('b', [{ ...shared, id: 'y' }])], [], window);
    expect(plan.insert.map((i) => i.accountId)).toEqual(['a']);
  });

  it('fills a blank title and trims', () => {
    const plan = planSync([acct('a', [ev('1', { title: '  ', location: ' ' })])], [], window);
    expect(plan.insert[0]).toMatchObject({ title: '(no title)', location: null });
  });
});

describe('helpers', () => {
  it('picks an unused colour, then cycles', () => {
    expect(pickColor([])).toBe(ACCOUNT_COLORS[0]);
    expect(pickColor([ACCOUNT_COLORS[0]])).toBe(ACCOUNT_COLORS[1]);
    expect(ACCOUNT_COLORS).toContain(pickColor([...ACCOUNT_COLORS]));
  });
  it('syncs 30 days back and 90 ahead from local midnight', () => {
    const w = syncWindow(new Date(2026, 8, 25, 15, 30));
    expect(w.from).toBe(new Date(2026, 7, 26).getTime());
    expect(w.to).toBe(new Date(2026, 11, 24).getTime());
  });
});
