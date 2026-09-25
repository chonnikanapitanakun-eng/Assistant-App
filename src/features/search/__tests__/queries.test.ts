import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('@/db', () => import('@/db/__tests__/mock-db'));

const { resetDb } = await import('@/db/__tests__/mock-db');
const { db, tasks, notes, contacts, transactions, wallets, categories, calendarEvents } = await import('@/db');
const { searchAll } = await import('../queries');

beforeEach(() => {
  resetDb();
});

describe('searchAll', () => {
  it('returns null for an empty/whitespace query', async () => {
    expect(await searchAll('')).toBeNull();
    expect(await searchAll('   ')).toBeNull();
  });

  it('finds a task by a trigram match on its title', async () => {
    await db.insert(tasks).values({ id: 't1', title: 'Invoice review', createdAt: 1, updatedAt: 1 });
    const results = await searchAll('invoice');
    expect(results?.groups.task.map((t) => t.id)).toEqual(['t1']);
    expect(results?.total).toBe(1);
  });

  it('excludes a soft-deleted task even though it is still indexed', async () => {
    await db.insert(tasks).values({ id: 't1', title: 'Invoice review', createdAt: 1, updatedAt: 1 });
    await db.insert(tasks).values({ id: 't2', title: 'Invoice follow-up', createdAt: 1, updatedAt: 1, deletedAt: 2 });
    const results = await searchAll('invoice');
    expect(results?.groups.task.map((t) => t.id)).toEqual(['t1']);
  });

  it('searches notes, contacts and events by their indexed fields', async () => {
    await db.insert(notes).values({ id: 'n1', title: 'Budget planning', body: '', createdAt: 1, updatedAt: 1 });
    await db.insert(contacts).values({ id: 'c1', name: 'Budget Client', createdAt: 1, updatedAt: 1 });
    await db.insert(calendarEvents).values({ id: 'e1', externalId: 'e1', source: 'veyra', title: 'Budget review', start: 0, end: 1, isAllDay: false, createdAt: 1, updatedAt: 1 });
    const results = await searchAll('budget');
    expect(results?.groups.note.map((n) => n.id)).toEqual(['n1']);
    expect(results?.groups.contact.map((c) => c.id)).toEqual(['c1']);
    expect(results?.groups.event.map((e) => e.id)).toEqual(['e1']);
  });

  it('resolves each transaction hit with its category', async () => {
    await db.insert(wallets).values({ id: 'w1', name: 'Cash', type: 'cash', currency: 'THB', createdAt: 1, updatedAt: 1 });
    await db.insert(categories).values({ id: 'cat1', nameTh: 'อาหาร', nameEn: 'Food', type: 'expense', createdAt: 1, updatedAt: 1 });
    await db.insert(transactions).values({
      id: 'tx1',
      walletId: 'w1',
      categoryId: 'cat1',
      amount: 120,
      currency: 'THB',
      type: 'expense',
      note: 'Coffee meeting',
      date: '2026-09-25',
      createdAt: 1,
      updatedAt: 1,
    });
    const results = await searchAll('coffee');
    expect(results?.groups.transaction).toEqual([{ id: 'tx1', tx: expect.objectContaining({ id: 'tx1' }), category: expect.objectContaining({ id: 'cat1' }) }]);
  });
});
