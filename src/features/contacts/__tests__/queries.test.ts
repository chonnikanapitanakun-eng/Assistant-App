import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('@/db', () => import('@/db/__tests__/mock-db'));

const { resetDb } = await import('@/db/__tests__/mock-db');
const { db, contacts, links } = await import('@/db');
const { createContact, deleteContact, filterContacts } = await import('../queries');
const { linkContact } = await import('../links');
const { commit } = await import('@/db');
const { eq } = await import('drizzle-orm');

const values = { name: 'Somchai', company: 'ABC Co', role: null, email: 'som@abc.co', phone: '081-234-5678', lineId: null, areaId: null, notes: null };

beforeEach(() => {
  resetDb();
});

describe('filterContacts', () => {
  const list = [
    { ...values, id: '1' },
    { ...values, id: '2', name: 'Jane', company: null, email: null, phone: null },
  ] as Parameters<typeof filterContacts>[0];
  it('matches name, company, email or phone, case-insensitively', () => {
    expect(filterContacts(list, 'abc').map((c) => c.id)).toEqual(['1']);
    expect(filterContacts(list, 'JANE').map((c) => c.id)).toEqual(['2']);
    expect(filterContacts(list, '234').map((c) => c.id)).toEqual(['1']);
  });
  it('returns everything for an empty query', () => {
    expect(filterContacts(list, '  ')).toHaveLength(2);
  });
});

describe('deleteContact', () => {
  it('soft-deletes the contact and its links', async () => {
    const id = await createContact(values);
    await commit([linkContact('task', 't1', id)]);
    await deleteContact(id);
    const row = await db.select().from(contacts).where(eq(contacts.id, id)).get();
    expect(row?.deletedAt).not.toBeNull();
    const link = await db.select().from(links).where(eq(links.toId, id)).get();
    expect(link?.deletedAt).not.toBeNull();
  });
});
