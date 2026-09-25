import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('@/db', () => import('@/db/__tests__/mock-db'));

const { resetDb } = await import('@/db/__tests__/mock-db');
const { db, assistantMessages } = await import('@/db');
const { addMessage, updateCard, clearChat } = await import('../queries');
const { eq, isNull } = await import('drizzle-orm');

beforeEach(() => {
  resetDb();
});

describe('addMessage', () => {
  it('stores role/text/payload and returns the new id', async () => {
    const id = await addMessage('user', 'สวัสดี');
    const msg = await db.select().from(assistantMessages).where(eq(assistantMessages.id, id)).get();
    expect(msg).toMatchObject({ role: 'user', text: 'สวัสดี', payload: null });
  });

  it('stores a payload with cards/suggestions', async () => {
    const payload = { cards: [{ type: 'list' as const, rows: [] }], suggestions: ['ดูงบเดือนนี้'] };
    const id = await addMessage('assistant', 'นี่คืองบเดือนนี้', payload);
    const msg = await db.select().from(assistantMessages).where(eq(assistantMessages.id, id)).get();
    expect(msg?.payload).toEqual(payload);
  });
});

describe('updateCard', () => {
  it('patches only the matching proposal card, leaving others untouched', async () => {
    const payload = {
      cards: [
        { type: 'proposal' as const, id: 'p1', proposal: { kind: 'complete_task' as const, taskId: 't1', title: 'A' }, state: 'pending' as const },
        { type: 'proposal' as const, id: 'p2', proposal: { kind: 'complete_task' as const, taskId: 't2', title: 'B' }, state: 'pending' as const },
      ],
      suggestions: [],
    };
    const id = await addMessage('assistant', 'ยืนยันไหม', payload);
    await updateCard(id, 'p1', { state: 'done' });

    const after = await db.select().from(assistantMessages).where(eq(assistantMessages.id, id)).get();
    const cards = (after!.payload as typeof payload).cards;
    expect(cards.find((c) => c.id === 'p1')?.state).toBe('done');
    expect(cards.find((c) => c.id === 'p2')?.state).toBe('pending');
  });
});

describe('clearChat', () => {
  it('soft-deletes every live message', async () => {
    await addMessage('user', 'a');
    await addMessage('assistant', 'b');
    await clearChat();
    const live = await db.select().from(assistantMessages).where(isNull(assistantMessages.deletedAt)).all();
    expect(live).toHaveLength(0);
    expect(await db.select().from(assistantMessages).all()).toHaveLength(2);
  });
});
