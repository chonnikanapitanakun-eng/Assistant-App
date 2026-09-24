import { and, desc, eq, isNull } from 'drizzle-orm';

import { db, notes, useRows, type Note } from '@/db';
import { newId, now } from '@/lib/ids';

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
