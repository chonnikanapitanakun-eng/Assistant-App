import { desc, isNull } from 'drizzle-orm';
import { useLiveQuery } from 'drizzle-orm/expo-sqlite';

import { db, notes } from '@/db';

export function useNotes() {
  const { data } = useLiveQuery(db.select().from(notes).where(isNull(notes.deletedAt)).orderBy(desc(notes.pinned), desc(notes.updatedAt)));
  return data;
}
