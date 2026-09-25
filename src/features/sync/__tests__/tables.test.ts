import { describe, expect, it } from 'vitest';

import { tasks } from '@/db/schema';

import { fromRemote, remoteName, toRemote } from '../tables';

describe('sync/tables codec', () => {
  it('maps JS keys to their SQL column names and drops local-only fields', () => {
    const row = { id: 't1', userId: null, createdAt: 1, updatedAt: 2, deletedAt: null, syncedAt: 5, title: 'Pay VAT', isDone: false, priority: 2, sortOrder: 0 };
    const remote = toRemote(tasks, row, 'user-1');
    expect(remote).toEqual({ id: 't1', user_id: 'user-1', created_at: 1, updated_at: 2, deleted_at: null, title: 'Pay VAT', is_done: false, priority: 2, sort_order: 0 });
    expect(remote).not.toHaveProperty('synced_at');
  });

  it('maps SQL column names back to JS keys, round-tripping through toRemote', () => {
    const row = { id: 't1', userId: null, createdAt: 1, updatedAt: 2, deletedAt: null, syncedAt: 5, title: 'Pay VAT', isDone: true, priority: 1, sortOrder: 3 };
    const local = fromRemote(tasks, toRemote(tasks, row, 'user-1'));
    expect(local).toEqual({ id: 't1', userId: 'user-1', createdAt: 1, updatedAt: 2, deletedAt: null, title: 'Pay VAT', isDone: true, priority: 1, sortOrder: 3 });
  });

  it('uses the sqlite table name as the Postgres table name', () => {
    expect(remoteName(tasks)).toBe('tasks');
  });
});
