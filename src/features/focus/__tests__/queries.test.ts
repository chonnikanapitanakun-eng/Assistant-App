import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('@/db', () => import('@/db/__tests__/mock-db'));

const { resetDb } = await import('@/db/__tests__/mock-db');
const { db, focusSessions } = await import('@/db');
const { logSession } = await import('../queries');
const { isNull } = await import('drizzle-orm');

beforeEach(() => {
  resetDb();
});

describe('logSession', () => {
  it('inserts a live focus session with the given fields', async () => {
    await logSession({ taskId: 't1', startedAt: 1_000, durationMin: 25, completed: true });
    const rows = await db.select().from(focusSessions).where(isNull(focusSessions.deletedAt)).all();
    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({ taskId: 't1', startedAt: 1_000, durationMin: 25, completed: true });
    expect(rows[0].createdAt).toBeTypeOf('number');
  });

  it('accepts a session with no linked task', async () => {
    await logSession({ taskId: null, startedAt: 2_000, durationMin: 10, completed: false });
    const rows = await db.select().from(focusSessions).all();
    expect(rows[0]).toMatchObject({ taskId: null, completed: false });
  });
});
