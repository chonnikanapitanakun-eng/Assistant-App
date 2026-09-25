import { describe, expect, it } from 'vitest';

import { chunk, decide, incomingColumns, isDirty, planSeedMerge, toRemote, type LocalRow, type RemoteRow } from '../engine';
import { syncTableByName, syncTables } from '../tables';

const tasks = syncTableByName.get('tasks')!;
const areas = syncTableByName.get('areas')!;

const localTask = (over: Partial<LocalRow> = {}): LocalRow => ({
  id: 't1',
  user_id: null,
  created_at: 100,
  updated_at: 200,
  deleted_at: null,
  synced_at: null,
  title: 'VAT return',
  notes: null,
  is_done: 0,
  checklist: '[{"id":"c1","text":"Export","done":false}]',
  reminder_notification_id: 'notif-1',
  ...over,
});

describe('tables registry', () => {
  it('describes every synced table with its SQL column names', () => {
    expect(syncTables.map((t) => t.name)).toEqual(['areas', 'categories', 'wallets', 'contacts', 'routines', 'tasks', 'notes', 'transactions', 'recurring_bills', 'checkins', 'focus_sessions', 'links', 'assistant_messages']);
    expect(tasks.columns).toContain('reminder_notification_id');
    expect(tasks.columns).toContain('is_done');
    expect(tasks.localOnly).toEqual(['reminder_notification_id']);
  });

  it('leaves Google Calendar tables to the calendar import', () => {
    expect(syncTableByName.has('calendar_events')).toBe(false);
    expect(syncTableByName.has('calendar_accounts')).toBe(false);
  });
});

describe('isDirty', () => {
  it('is dirty when never synced or edited since', () => {
    expect(isDirty({ updated_at: 5, synced_at: null })).toBe(true);
    expect(isDirty({ updated_at: 6, synced_at: 5 })).toBe(true);
    expect(isDirty({ updated_at: 5, synced_at: 5 })).toBe(false);
  });
});

describe('toRemote', () => {
  it('sends content columns only, never bookkeeping or device-only ones', () => {
    const r = toRemote(tasks, localTask());
    expect(r).toMatchObject({ table: 'tasks', id: 't1', updated_at: 200, deleted_at: null });
    expect(r.data.title).toBe('VAT return');
    expect(r.data.checklist).toBe('[{"id":"c1","text":"Export","done":false}]');
    expect(r.data).not.toHaveProperty('user_id');
    expect(r.data).not.toHaveProperty('synced_at');
    expect(r.data).not.toHaveProperty('reminder_notification_id');
    expect(r.data.notes).toBeNull();
  });
});

describe('incomingColumns', () => {
  const incoming: RemoteRow = {
    table: 'tasks',
    id: 't1',
    data: { id: 't1', title: 'Renamed', reminder_notification_id: 'other-device', from_the_future: 1, updated_at: 1, deleted_at: null },
    updated_at: 300,
    deleted_at: 400,
  };

  it('keeps known content columns and drops the rest', () => {
    const { columns } = incomingColumns(tasks, incoming);
    expect(columns).toContain('title');
    expect(columns).not.toContain('reminder_notification_id');
    expect(columns).not.toContain('from_the_future');
    expect(columns).not.toContain('user_id');
  });

  it('takes updated_at / deleted_at from the envelope, not the payload', () => {
    const { columns, values } = incomingColumns(tasks, incoming);
    expect(values[columns.indexOf('updated_at')]).toBe(300);
    expect(values[columns.indexOf('deleted_at')]).toBe(400);
    expect(values[columns.indexOf('id')]).toBe('t1');
  });
});

describe('decide (last-write-wins)', () => {
  const incoming: RemoteRow = { table: 'tasks', id: 't1', data: {}, updated_at: 200, deleted_at: null };

  it('applies a row we do not have', () => {
    expect(decide(incoming, undefined)).toBe('apply');
  });
  it('applies a newer server version over an older local one', () => {
    expect(decide(incoming, { updated_at: 150, synced_at: 150 })).toBe('apply');
  });
  it('keeps a newer local edit (it will push and win on the server too)', () => {
    expect(decide(incoming, { updated_at: 250, synced_at: 150 })).toBe('keep_local');
  });
  it('recognises our own pushed row coming back', () => {
    expect(decide(incoming, { updated_at: 200, synced_at: 200 })).toBe('echo');
  });
  it('re-applies an equal timestamp when the local row is not marked synced', () => {
    expect(decide(incoming, { updated_at: 200, synced_at: null })).toBe('apply');
  });
});

describe('planSeedMerge', () => {
  const area = (id: string, nameEn: string, over: Partial<LocalRow> = {}): LocalRow => ({ id, user_id: null, created_at: 1, updated_at: 1, deleted_at: null, synced_at: null, name_th: nameEn, name_en: nameEn, parent_id: null, ...over });
  const remote = (id: string, nameEn: string, deleted: number | null = null): RemoteRow => ({ table: 'areas', id, data: { id, name_th: nameEn, name_en: nameEn }, updated_at: 5, deleted_at: deleted });

  it('maps an unsynced local default onto the incoming row with the same name', () => {
    const map = planSeedMerge(areas, [area('local-work', 'Work'), area('local-fun', 'Fun')], [remote('cloud-work', 'Work'), remote('cloud-study', 'Study')]);
    expect([...map]).toEqual([['local-work', 'cloud-work']]);
  });

  it('never touches rows that were already pushed, deleted, or already share the id', () => {
    const map = planSeedMerge(areas, [area('a', 'Work', { synced_at: 1 }), area('b', 'Study', { deleted_at: 2 }), area('cloud-x', 'X')], [remote('cloud-work', 'Work'), remote('cloud-study', 'Study'), remote('cloud-x', 'X')]);
    expect(map.size).toBe(0);
  });

  it('ignores incoming rows that are themselves deleted, and tables without a natural key', () => {
    expect(planSeedMerge(areas, [area('a', 'Work')], [remote('cloud-work', 'Work', 9)]).size).toBe(0);
    expect(planSeedMerge(tasks, [localTask()], [{ table: 'tasks', id: 'x', data: { title: 'VAT return' }, updated_at: 1, deleted_at: null }]).size).toBe(0);
  });
});

describe('chunk', () => {
  it('splits into batches and handles empty input', () => {
    expect(chunk([1, 2, 3, 4, 5], 2)).toEqual([[1, 2], [3, 4], [5]]);
    expect(chunk([], 3)).toEqual([]);
  });
});
