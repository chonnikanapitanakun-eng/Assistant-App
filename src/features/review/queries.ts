import { and, asc, gte, isNull, lte } from 'drizzle-orm';

import { checkins, db, useRows } from '@/db';

/** Mood / energy check-ins with `date` in [from, to] (dateKeys, both inclusive). */
export function useCheckinsBetween(from: string, to: string) {
  return useRows(db.select().from(checkins).where(and(isNull(checkins.deletedAt), gte(checkins.date, from), lte(checkins.date, to))).orderBy(asc(checkins.date))).data;
}
