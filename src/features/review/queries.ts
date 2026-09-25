import { and, desc, eq, isNull } from 'drizzle-orm';

import { checkins, db, useRows, type Checkin } from '@/db';
import { newId, now } from '@/lib/ids';

/** Every live check-in, newest first — the Review screen slices what it needs in memory. */
export function useCheckins(): Checkin[] {
  return useRows(db.select().from(checkins).where(isNull(checkins.deletedAt)).orderBy(desc(checkins.date))).data;
}

/** Today's (or any single date's) check-in. `loaded` separates "still loading" from "not logged yet". */
export function useCheckinForDate(date: string): { checkin: Checkin | undefined; loaded: boolean } {
  const { data, loaded } = useRows(db.select().from(checkins).where(and(eq(checkins.date, date), isNull(checkins.deletedAt))));
  return { checkin: data[0], loaded };
}

export type CheckinPatch = Partial<Pick<Checkin, 'mood' | 'energy' | 'reflection'>>;

/**
 * Create or update the check-in for a date. `date` is unique, so this is one atomic
 * upsert: a fresh row on the first save of the day, a partial update after that.
 */
export async function saveCheckin(date: string, patch: CheckinPatch): Promise<void> {
  const t = now();
  await db
    .insert(checkins)
    .values({ id: newId(), date, mood: null, energy: null, reflection: null, createdAt: t, updatedAt: t, ...patch })
    .onConflictDoUpdate({ target: checkins.date, set: { ...patch, updatedAt: t } });
}
