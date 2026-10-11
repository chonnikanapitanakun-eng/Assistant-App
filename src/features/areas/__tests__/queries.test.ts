import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('@/db', () => import('@/db/__tests__/mock-db'));

const { resetDb } = await import('@/db/__tests__/mock-db');
const { db, areas, tasks } = await import('@/db');
const { createArea, deleteArea, groupAreas, reorderSiblings, areaIcon } = await import('../queries');
const { newId, now } = await import('@/lib/ids');
const { eq } = await import('drizzle-orm');

beforeEach(() => {
  resetDb();
});

describe('areas', () => {
  it('groups children under their parent in sort order', async () => {
    const work = await createArea({ nameTh: 'งาน', nameEn: 'Work', parentId: null, color: null, icon: null }, 1);
    await createArea({ nameTh: 'B', nameEn: 'B', parentId: work, color: null, icon: null }, 3);
    await createArea({ nameTh: 'A', nameEn: 'A', parentId: work, color: null, icon: null }, 2);
    const groups = groupAreas(await db.select().from(areas).all());
    expect(groups).toHaveLength(1);
    expect(groups[0].children.map((c) => c.nameEn)).toEqual(['A', 'B']);
  });

  it('deleting an area deletes its projects and unfiles their tasks', async () => {
    const work = await createArea({ nameTh: 'งาน', nameEn: 'Work', parentId: null, color: null, icon: null }, 1);
    const client = await createArea({ nameTh: 'ลูกค้า', nameEn: 'Clients', parentId: work, color: null, icon: null }, 2);
    const t = now();
    const taskId = newId();
    await db.insert(tasks).values({ id: taskId, title: 'VAT', areaId: client, createdAt: t, updatedAt: t });
    await deleteArea(work);
    const child = await db.select().from(areas).where(eq(areas.id, client)).get();
    expect(child?.deletedAt).not.toBeNull();
    const task = await db.select().from(tasks).where(eq(tasks.id, taskId)).get();
    expect(task?.areaId).toBeNull();
  });
});

describe('reorder + icon', () => {
  const row = (id: string, sortOrder: number, parentId: string | null = null) => ({ id, sortOrder, parentId }) as Parameters<typeof reorderSiblings>[0][number];

  it('swaps with the neighbour among siblings only', () => {
    const list = [row('a', 0), row('b', 1), row('c', 2), row('x', 0, 'a')];
    expect(reorderSiblings(list, 'c', -1)).toEqual([{ id: 'c', sortOrder: 1 }, { id: 'b', sortOrder: 2 }]);
    expect(reorderSiblings(list, 'a', -1)).toEqual([]);
    expect(reorderSiblings(list, 'x', 1)).toEqual([]);
  });

  it('still moves when sort orders tie', () => {
    expect(reorderSiblings([row('a', 0), row('b', 0)], 'b', -1).length).toBeGreaterThan(0);
  });

  it('falls back to the parent icon, then a folder', () => {
    expect(areaIcon({ icon: 'heart' })).toBe('heart');
    expect(areaIcon({ icon: null }, { icon: 'book' })).toBe('book');
    expect(areaIcon({ icon: 'rocket' })).toBe('folder');
  });
});
