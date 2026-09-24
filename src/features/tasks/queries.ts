import { and, asc, eq, isNull } from 'drizzle-orm';
import { useLiveQuery } from 'drizzle-orm/expo-sqlite';

import { db, tasks } from '@/db';

export function useTasksForDate(date: string) {
  const { data } = useLiveQuery(
    db.select().from(tasks).where(and(eq(tasks.date, date), isNull(tasks.deletedAt))).orderBy(asc(tasks.startTime), asc(tasks.sortOrder)),
    [date],
  );
  return data;
}
