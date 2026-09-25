import { and, desc, eq, inArray, isNull } from 'drizzle-orm';

import { calendarEvents, contacts, db, notes, tasks, transactions, useDbQuery, useRows, type LinkableType, type Note } from '@/db';
import type { LinkRef } from '@/features/links/model';
import { outgoingRefs } from '@/features/links/queries';
import { newId, now } from '@/lib/ids';

import { recordSignature } from './model';

/** Pinned first, then most recently edited. */
export function useNotes(): Note[] {
  return useRows(db.select().from(notes).where(isNull(notes.deletedAt)).orderBy(desc(notes.pinned), desc(notes.updatedAt))).data;
}

export function useNote(id: string): { note: Note | undefined; loaded: boolean } {
  const { data, loaded } = useRows(db.select().from(notes).where(and(eq(notes.id, id), isNull(notes.deletedAt))));
  return { note: data[0], loaded };
}

export async function createNote(initial: Partial<Pick<Note, 'title' | 'body' | 'tags'>> = {}): Promise<string> {
  const id = newId();
  const t = now();
  await db.insert(notes).values({ id, title: '', body: '', tags: [], ...initial, createdAt: t, updatedAt: t });
  return id;
}

export async function updateNote(id: string, patch: Partial<Pick<Note, 'title' | 'body' | 'tags' | 'pinned'>>) {
  await db.update(notes).set({ ...patch, updatedAt: now() }).where(eq(notes.id, id));
}

export async function deleteNote(id: string) {
  const t = now();
  await db.update(notes).set({ deletedAt: t, updatedAt: t }).where(eq(notes.id, id));
}

/**
 * Signatures (`itemSignature`) of what Extract already saved from this note: its live `extracted`
 * links, plus the people linked to those records. `undefined` while loading.
 */
export function useExtractedSignatures(noteId: string): Set<string> | undefined {
  return useDbQuery(['note-extracted', noteId], async () => {
    const records = await outgoingRefs([{ type: 'note', id: noteId }], { relation: 'extracted' });
    const people = records.length ? await outgoingRefs(records, { relation: 'with', toType: 'contact' }) : [];
    const ids = (refs: LinkRef[], type: LinkableType) => refs.filter((r) => r.type === type).map((r) => r.id);
    const sigs = new Set<string>();
    const add = (sig: string | null) => sig && sigs.add(sig);
    const taskIds = ids(records, 'task');
    const eventIds = ids(records, 'event');
    const txIds = ids(records, 'transaction');
    const contactIds = ids(people, 'contact');
    if (taskIds.length) for (const row of await db.select().from(tasks).where(and(inArray(tasks.id, taskIds), isNull(tasks.deletedAt))).all()) add(recordSignature({ type: 'task', row }));
    if (eventIds.length) for (const row of await db.select().from(calendarEvents).where(and(inArray(calendarEvents.id, eventIds), isNull(calendarEvents.deletedAt))).all()) add(recordSignature({ type: 'event', row }));
    if (txIds.length) for (const row of await db.select().from(transactions).where(and(inArray(transactions.id, txIds), isNull(transactions.deletedAt))).all()) add(recordSignature({ type: 'transaction', row }));
    if (contactIds.length) for (const row of await db.select().from(contacts).where(and(inArray(contacts.id, contactIds), isNull(contacts.deletedAt))).all()) add(recordSignature({ type: 'contact', row }));
    return sigs;
  });
}
