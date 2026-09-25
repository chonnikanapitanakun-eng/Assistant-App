import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('@/db', () => import('@/db/__tests__/mock-db'));

const { resetDb } = await import('@/db/__tests__/mock-db');
const { db, contacts, links } = await import('@/db');
const { resolveContact, linkContact, linkedContactWrites } = await import('../links');
const { newId, now } = await import('@/lib/ids');
const { eq, and, isNull } = await import('drizzle-orm');

beforeEach(() => {
  resetDb();
});

describe('resolveContact', () => {
  it('returns an insert write for a brand new name', async () => {
    const resolved = await resolveContact('คุณเอ');
    expect(resolved.create).toBeTruthy();
    await db.batch([resolved.create!]);
    const saved = await db.select().from(contacts).where(eq(contacts.id, resolved.id)).get();
    expect(saved?.name).toBe('คุณเอ');
  });

  it('matches an existing contact case-insensitively and returns no create write', async () => {
    const t = now();
    const id = newId();
    await db.insert(contacts).values({ id, name: 'Khun A', createdAt: t, updatedAt: t });
    const resolved = await resolveContact('khun a');
    expect(resolved.id).toBe(id);
    expect(resolved.create).toBeNull();
  });

  it('ignores a soft-deleted contact with the same name', async () => {
    const t = now();
    await db.insert(contacts).values({ id: newId(), name: 'คุณบี', createdAt: t, updatedAt: t, deletedAt: t });
    const resolved = await resolveContact('คุณบี');
    expect(resolved.create).toBeTruthy();
  });
});

describe('linkContact', () => {
  it('builds a "with" link write from a record to a contact', async () => {
    const write = linkContact('task', 't1', 'c1');
    await db.batch([write]);
    const [link] = await db.select().from(links).all();
    expect(link).toMatchObject({ fromType: 'task', fromId: 't1', toType: 'contact', toId: 'c1', relation: 'with' });
  });
});

describe('linkedContactWrites', () => {
  const liveLinksFor = (fromId: string) => db.select().from(links).where(and(eq(links.fromId, fromId), isNull(links.deletedAt))).all();

  it('adds a new "with" link for a name that has no existing contact', async () => {
    await db.batch(await linkedContactWrites('task', 't1', 'คุณซี') as never);
    const live = await liveLinksFor('t1');
    expect(live).toHaveLength(1);
    expect(live[0].relation).toBe('with');
  });

  it('replaces the previous contact link (soft-deletes the old, adds the new)', async () => {
    await db.batch(await linkedContactWrites('task', 't1', 'คุณซี') as never);
    const first = (await liveLinksFor('t1'))[0];

    await db.batch(await linkedContactWrites('task', 't1', 'คุณดี') as never);
    const live = await liveLinksFor('t1');

    expect(live).toHaveLength(1);
    expect(live[0].id).not.toBe(first.id);
    const oldLink = await db.select().from(links).where(eq(links.id, first.id)).get();
    expect(oldLink?.deletedAt).toBeTypeOf('number');
  });

  it('reuses the same contact when re-linking the identical name', async () => {
    await db.batch(await linkedContactWrites('task', 't1', 'คุณอี') as never);
    await db.batch(await linkedContactWrites('task', 't1', 'คุณอี') as never);
    expect(await db.select().from(contacts).all()).toHaveLength(1);
  });

  it('an empty/blank name just clears the link', async () => {
    await db.batch(await linkedContactWrites('task', 't1', 'คุณเอฟ') as never);
    expect(await liveLinksFor('t1')).toHaveLength(1);

    await db.batch(await linkedContactWrites('task', 't1', '   ') as never);
    expect(await liveLinksFor('t1')).toHaveLength(0);
  });

  it('a null name clears the link without adding a new one', async () => {
    await db.batch(await linkedContactWrites('task', 't1', null) as never);
    expect(await liveLinksFor('t1')).toHaveLength(0);
  });
});
