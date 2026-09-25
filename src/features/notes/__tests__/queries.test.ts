import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('@/db', () => import('@/db/__tests__/mock-db'));

const { resetDb } = await import('@/db/__tests__/mock-db');
const { createNote, updateNote, deleteNote } = await import('../queries');
const { db, notes } = await import('@/db');
const { eq } = await import('drizzle-orm');

beforeEach(() => {
  resetDb();
});

describe('createNote', () => {
  it('defaults to empty title/body/tags', async () => {
    const id = await createNote();
    const note = await db.select().from(notes).where(eq(notes.id, id)).get();
    expect(note).toMatchObject({ title: '', body: '', tags: [] });
    expect(note?.pinned).toBe(false);
    expect(note?.deletedAt).toBeNull();
  });

  it('accepts initial values', async () => {
    const id = await createNote({ title: 'หัวข้อ', body: 'เนื้อหา', tags: ['tax', 'cima'] });
    const note = await db.select().from(notes).where(eq(notes.id, id)).get();
    expect(note).toMatchObject({ title: 'หัวข้อ', body: 'เนื้อหา', tags: ['tax', 'cima'] });
  });
});

describe('updateNote', () => {
  it('patches only the given fields and bumps updatedAt', async () => {
    const id = await createNote({ title: 'เดิม', body: 'body' });
    const before = await db.select().from(notes).where(eq(notes.id, id)).get();
    await new Promise((r) => setTimeout(r, 2));
    await updateNote(id, { title: 'ใหม่' });
    const after = await db.select().from(notes).where(eq(notes.id, id)).get();
    expect(after?.title).toBe('ใหม่');
    expect(after?.body).toBe('body');
    expect(after!.updatedAt).toBeGreaterThan(before!.updatedAt);
  });

  it('can pin a note', async () => {
    const id = await createNote();
    await updateNote(id, { pinned: true });
    const note = await db.select().from(notes).where(eq(notes.id, id)).get();
    expect(note?.pinned).toBe(true);
  });
});

describe('deleteNote', () => {
  it('soft-deletes: stamps deletedAt but keeps the row', async () => {
    const id = await createNote({ title: 'จะลบ' });
    await deleteNote(id);
    const note = await db.select().from(notes).where(eq(notes.id, id)).get();
    expect(note?.deletedAt).toBeTypeOf('number');
    expect(note?.title).toBe('จะลบ');
  });
});
