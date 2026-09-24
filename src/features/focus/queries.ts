import { desc, isNull } from 'drizzle-orm';
import { useLiveQuery } from 'drizzle-orm/expo-sqlite';

import { db, focusSessions } from '@/db';
import { newId, now } from '@/lib/ids';

/** Recent focus sessions, newest first (enough for weekly insights and the log). */
export function useFocusSessions() {
  const { data } = useLiveQuery(db.select().from(focusSessions).where(isNull(focusSessions.deletedAt)).orderBy(desc(focusSessions.startedAt)).limit(200));
  return data;
}

export function logSession(s: { taskId: string | null; startedAt: number; durationMin: number; completed: boolean }) {
  const t = now();
  db.insert(focusSessions).values({ id: newId(), ...s, createdAt: t, updatedAt: t }).run();
}
