import { and, eq, isNull, sql } from 'drizzle-orm';

import { contacts, db, links, type LinkableType } from '@/db';
import { newId, now } from '@/lib/ids';

/** The db itself or an open transaction. */
export type Writer = typeof db | Parameters<Parameters<typeof db.transaction>[0]>[0];

/** Find a live contact by name (case-insensitive) or create it. Returns its id. */
export function findOrCreateContact(w: Writer, name: string): string {
  const existing = w
    .select({ id: contacts.id })
    .from(contacts)
    .where(and(sql`lower(${contacts.name}) = ${name.toLowerCase()}`, isNull(contacts.deletedAt)))
    .get();
  if (existing) return existing.id;
  const id = newId();
  const t = now();
  w.insert(contacts).values({ id, name, createdAt: t, updatedAt: t }).run();
  return id;
}

export function linkContact(w: Writer, fromType: LinkableType, fromId: string, contactId: string) {
  const t = now();
  w.insert(links).values({ id: newId(), fromType, fromId, toType: 'contact', toId: contactId, relation: 'with', createdAt: t, updatedAt: t }).run();
}

/** Replace the "with" contact of a record (soft-deletes previous links). Empty name clears it. */
export function setLinkedContact(w: Writer, fromType: LinkableType, fromId: string, name: string | null) {
  const t = now();
  w.update(links)
    .set({ deletedAt: t, updatedAt: t })
    .where(and(eq(links.fromType, fromType), eq(links.fromId, fromId), eq(links.toType, 'contact'), isNull(links.deletedAt)))
    .run();
  const trimmed = name?.trim();
  if (trimmed) linkContact(w, fromType, fromId, findOrCreateContact(w, trimmed));
}
