import { desc, isNull } from 'drizzle-orm';

import { db, focusSessions, useRows } from '@/db';
import { newId, now } from '@/lib/ids';

/** Recent focus sessions, newest first (enough for weekly insights and the log). */
export function useFocusSessions() {
  return useRows(db.select().from(focusSessions).where(isNull(focusSessions.deletedAt)).orderBy(desc(focusSessions.startedAt)).limit(200)).data;
}

export async function logSession(s: { taskId: string | null; startedAt: number; durationMin: number; completed: boolean }) {
  const t = now();
  await db.insert(focusSessions).values({ id: newId(), ...s, createdAt: t, updatedAt: t });
}
