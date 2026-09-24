import { and, desc, eq, isNull } from 'drizzle-orm';
import { useLiveQuery } from 'drizzle-orm/expo-sqlite';

import { db, notes, type Note } from '@/db';
import { newId, now } from '@/lib/ids';

/** Pinned first, then most recently edited. */
export function useNotes(): Note[] {
  const { data } = useLiveQuery(db.select().from(notes).where(isNull(notes.deletedAt)).orderBy(desc(notes.pinned), desc(notes.updatedAt)));
  return data;
}

export function useNote(id: string): { note: Note | undefined; loaded: boolean } {
  const { data, updatedAt } = useLiveQuery(db.select().from(notes).where(and(eq(notes.id, id), isNull(notes.deletedAt))), [id]);
  return { note: data[0], loaded: updatedAt !== undefined };
}

export function createNote(initial: Partial<Pick<Note, 'title' | 'body' | 'tags'>> = {}): string {
  const id = newId();
  const t = now();
  db.insert(notes).values({ id, title: '', body: '', tags: [], ...initial, createdAt: t, updatedAt: t }).run();
  return id;
}

export function updateNote(id: string, patch: Partial<Pick<Note, 'title' | 'body' | 'tags' | 'pinned'>>) {
  db.update(notes).set({ ...patch, updatedAt: now() }).where(eq(notes.id, id)).run();
}

export function deleteNote(id: string) {
  const t = now();
  db.update(notes).set({ deletedAt: t, updatedAt: t }).where(eq(notes.id, id)).run();
}
