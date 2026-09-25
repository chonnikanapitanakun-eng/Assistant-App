import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('@/db', () => import('@/db/__tests__/mock-db'));

const { resetDb } = await import('@/db/__tests__/mock-db');
const { db, tasks, notes, contacts, links } = await import('@/db');
const { addLink, removeLink, getRelated, resolveRefs } = await import('../queries');
const { eq } = await import('drizzle-orm');

beforeEach(() => {
  resetDb();
});

async function seedTask(id: string, title: string) {
  await db.insert(tasks).values({ id, title, createdAt: 1, updatedAt: 1 });
}
async function seedNote(id: string, title: string) {
  await db.insert(notes).values({ id, title, body: '', createdAt: 1, updatedAt: 1 });
}
async function seedContact(id: string, name: string) {
  await db.insert(contacts).values({ id, name, createdAt: 1, updatedAt: 1 });
}

describe('addLink', () => {
  it('links two records and is visible from either end', async () => {
    await seedTask('t1', 'งานหนึ่ง');
    await seedNote('n1', 'โน้ตหนึ่ง');
    await addLink({ type: 'task', id: 't1' }, { type: 'note', id: 'n1' });

    const fromTask = await getRelated({ type: 'task', id: 't1' });
    expect(fromTask.map((r) => r.ref)).toEqual([{ type: 'note', id: 'n1' }]);

    const fromNote = await getRelated({ type: 'note', id: 'n1' });
    expect(fromNote.map((r) => r.ref)).toEqual([{ type: 'task', id: 't1' }]);
  });

  it('is idempotent: linking the same pair twice reuses the existing link id', async () => {
    await seedTask('t1', 'งานหนึ่ง');
    await seedNote('n1', 'โน้ตหนึ่ง');
    const first = await addLink({ type: 'task', id: 't1' }, { type: 'note', id: 'n1' });
    const second = await addLink({ type: 'task', id: 't1' }, { type: 'note', id: 'n1' });
    expect(second).toBe(first);
    expect(await db.select().from(links).all()).toHaveLength(1);
  });

  it('reuses the link regardless of which side is "from"', async () => {
    await seedTask('t1', 'งานหนึ่ง');
    await seedNote('n1', 'โน้ตหนึ่ง');
    const first = await addLink({ type: 'task', id: 't1' }, { type: 'note', id: 'n1' });
    const second = await addLink({ type: 'note', id: 'n1' }, { type: 'task', id: 't1' });
    expect(second).toBe(first);
  });

  it('refuses to link a record to itself', async () => {
    await seedTask('t1', 'งานหนึ่ง');
    await expect(addLink({ type: 'task', id: 't1' }, { type: 'task', id: 't1' })).rejects.toThrow();
  });
});

describe('removeLink', () => {
  it('soft-deletes: no longer shows up in getRelated', async () => {
    await seedTask('t1', 'งานหนึ่ง');
    await seedNote('n1', 'โน้ตหนึ่ง');
    const linkId = await addLink({ type: 'task', id: 't1' }, { type: 'note', id: 'n1' });
    await removeLink(linkId);
    expect(await getRelated({ type: 'task', id: 't1' })).toEqual([]);
  });
});

describe('getRelated', () => {
  it('drops a related item whose target was soft-deleted, keeping the link row itself', async () => {
    await seedTask('t1', 'งานหนึ่ง');
    await seedNote('n1', 'โน้ตหนึ่ง');
    const linkId = await addLink({ type: 'task', id: 't1' }, { type: 'note', id: 'n1' });
    await db.update(notes).set({ deletedAt: 1 }).where(eq(notes.id, 'n1'));

    expect(await getRelated({ type: 'task', id: 't1' })).toEqual([]);
    expect(await db.select().from(links).where(eq(links.id, linkId)).get()).toBeTruthy();
  });
});

describe('resolveRefs', () => {
  it('resolves refs across multiple types in one call and skips deleted targets', async () => {
    await seedTask('t1', 'งานหนึ่ง');
    await seedContact('c1', 'คุณเอ');
    const map = await resolveRefs(
      [
        { type: 'task', id: 't1' },
        { type: 'contact', id: 'c1' },
        { type: 'task', id: 'missing' },
      ],
      'th',
    );
    expect(map.get('task:t1')?.title).toBe('งานหนึ่ง');
    expect(map.get('contact:c1')?.title).toBe('คุณเอ');
    expect(map.has('task:missing')).toBe(false);
  });
});
