import { and, asc, eq, isNull, or } from 'drizzle-orm';

import { commit, contacts, db, links, useRows, type Contact } from '@/db';
import { newId, now } from '@/lib/ids';

/** Live contacts, A–Z. */
export function useContacts(): Contact[] {
  return useRows(db.select().from(contacts).where(isNull(contacts.deletedAt)).orderBy(asc(contacts.name))).data;
}

/** Single contact for contact/[id]. `loaded` separates "still loading" from "not found". */
export function useContact(id: string): { contact: Contact | undefined; loaded: boolean } {
  const { data, loaded } = useRows(db.select().from(contacts).where(and(eq(contacts.id, id), isNull(contacts.deletedAt))));
  return { contact: data[0], loaded };
}

export type ContactFormValues = Pick<Contact, 'name' | 'company' | 'role' | 'email' | 'phone' | 'lineId' | 'areaId' | 'notes'>;

/** Case-insensitive match on name, company, email or phone. Empty query → everything. */
export function filterContacts(list: Contact[], query: string): Contact[] {
  const q = query.trim().toLowerCase();
  if (!q) return list;
  return list.filter((c) => [c.name, c.company, c.role, c.email, c.phone, c.lineId].some((v) => v?.toLowerCase().includes(q)));
}

export async function createContact(values: ContactFormValues): Promise<string> {
  const id = newId();
  const t = now();
  await db.insert(contacts).values({ id, createdAt: t, updatedAt: t, ...values });
  return id;
}

export async function updateContact(id: string, values: ContactFormValues) {
  await db.update(contacts).set({ ...values, updatedAt: now() }).where(eq(contacts.id, id));
}

/** Soft delete, together with every link to or from it (the records themselves stay). */
export async function deleteContact(id: string) {
  const t = now();
  await commit([
    db.update(contacts).set({ deletedAt: t, updatedAt: t }).where(eq(contacts.id, id)),
    db
      .update(links)
      .set({ deletedAt: t, updatedAt: t })
      .where(and(isNull(links.deletedAt), or(and(eq(links.fromType, 'contact'), eq(links.fromId, id)), and(eq(links.toType, 'contact'), eq(links.toId, id))))),
  ]);
}

