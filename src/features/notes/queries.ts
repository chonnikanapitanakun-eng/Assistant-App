import { desc, isNull } from 'drizzle-orm';

import { db, notes, useDbQuery } from '@/db';

export function useNotes() {
  return (
    useDbQuery(['notes'], () => db.select().from(notes).where(isNull(notes.deletedAt)).orderBy(desc(notes.pinned), desc(notes.updatedAt)).all()) ??
    []
  );
}
