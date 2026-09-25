import { asc, isNull } from 'drizzle-orm';

import { calendarAccounts, db, useRows, type CalendarAccount } from '@/db';

export function useCalendarAccounts(): CalendarAccount[] {
  return useRows(db.select().from(calendarAccounts).where(isNull(calendarAccounts.deletedAt)).orderBy(asc(calendarAccounts.createdAt))).data;
}
