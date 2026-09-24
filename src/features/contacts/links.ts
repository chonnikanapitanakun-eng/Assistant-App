import { and, eq, isNull, sql } from 'drizzle-orm';

import { contacts, db, links, type LinkableType, type Write } from '@/db';
import { newId, now } from '@/lib/ids';

/*
 * These helpers read now and *return* the writes, so callers can commit them together with their
 * own inserts in one `commit([...])` (an atomic db.batch — see src/db/client.ts for why not db.transaction).
 */

/**
 * Find a live contact by name (case-insensitive). If there is none, pick a new id and return the
 * insert in `create` for the caller's batch.
 */
export async function resolveContact(name: string): Promise<{ id: string; create: Write | null }> {
  const existing = await db
    .select({ id: contacts.id })
    .from(contacts)
    .where(and(sql`lower(${contacts.name}) = ${name.toLowerCase()}`, isNull(contacts.deletedAt)))
    .get();
  if (existing) return { id: existing.id, create: null };
  const id = newId();
  const t = now();
  return { id, create: db.insert(contacts).values({ id, name, createdAt: t, updatedAt: t }) };
}

export function linkContact(fromType: LinkableType, fromId: string, contactId: string): Write {
  const t = now();
  return db.insert(links).values({ id: newId(), fromType, fromId, toType: 'contact', toId: contactId, relation: 'with', createdAt: t, updatedAt: t });
}

/** Writes that replace the "with" contact of a record (soft-deleting previous links). Empty name clears it. */
export async function linkedContactWrites(fromType: LinkableType, fromId: string, name: string | null): Promise<Write[]> {
  const t = now();
  const writes: Write[] = [
    db
      .update(links)
      .set({ deletedAt: t, updatedAt: t })
      .where(and(eq(links.fromType, fromType), eq(links.fromId, fromId), eq(links.toType, 'contact'), isNull(links.deletedAt))),
  ];
  const trimmed = name?.trim();
  if (trimmed) {
    const contact = await resolveContact(trimmed);
    if (contact.create) writes.push(contact.create);
    writes.push(linkContact(fromType, fromId, contact.id));
  }
  return writes;
}
