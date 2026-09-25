import { and, asc, eq, gt, isNull, lt } from 'drizzle-orm';
import { useMemo } from 'react';

import { calendarEvents, commit, contacts, db, links, useDbQuery, useRows, type CalendarEvent } from '@/db';
import { linkedContactWrites } from '@/features/contacts/links';
import { getTask, rescheduleTask } from '@/features/tasks/queries';
import { combineDateTime } from '@/lib/date';
import { newId, now } from '@/lib/ids';

import { eventInRange, eventRange, fromDateKey, type CalItem } from './model';

const DAY = 86_400_000;

/**
 * Live events in the dateKey range [from, to): timed events starting in it, and all-day events
 * on (or spanning into) those days. All-day rows are stored as UTC midnight, up to ±14h off local
 * time, so SQL fetches a day-padded overlap window and `eventInRange` does the exact match.
 */
export function useEventsBetween(from: string, to: string): CalendarEvent[] {
  const a = fromDateKey(from).getTime() - DAY;
  const b = fromDateKey(to).getTime() + DAY;
  const { data } = useRows(
    db
      .select()
      .from(calendarEvents)
      .where(and(isNull(calendarEvents.deletedAt), lt(calendarEvents.start, b), gt(calendarEvents.end, a)))
      .orderBy(asc(calendarEvents.start)),
  );
  return useMemo(() => data.filter((e) => eventInRange(e, from, to)), [data, from, to]);
}

export function useEvent(id: string): { event: CalendarEvent | undefined; contactName: string | null; loaded: boolean } {
  // Event and its linked contact in one read, so the form mounts once with both.
  const data = useDbQuery(['event', id], async () => {
    const event = await db.select().from(calendarEvents).where(and(eq(calendarEvents.id, id), isNull(calendarEvents.deletedAt))).get();
    const linked = await db
      .select({ name: contacts.name })
      .from(links)
      .innerJoin(contacts, eq(contacts.id, links.toId))
      .where(and(eq(links.fromType, 'event'), eq(links.fromId, id), eq(links.toType, 'contact'), isNull(links.deletedAt)))
      .get();
    return { event: event ?? null, contactName: linked?.name ?? null };
  });
  return { event: data?.event ?? undefined, contactName: data?.contactName ?? null, loaded: data !== undefined };
}

export type EventFormValues = {
  title: string;
  date: string;
  allDay: boolean;
  startTime: string;
  endTime: string;
  location: string | null;
  contactName: string | null;
};

export async function createEvent(v: EventFormValues): Promise<string> {
  const id = newId();
  const t = now();
  await commit([
    db.insert(calendarEvents).values({ id, externalId: id, source: 'veyra', title: v.title, location: v.location, isAllDay: v.allDay, ...eventRange(v), createdAt: t, updatedAt: t }),
    ...(await linkedContactWrites('event', id, v.contactName)),
  ]);
  return id;
}

export async function updateEvent(id: string, v: EventFormValues) {
  await commit([
    db.update(calendarEvents).set({ title: v.title, location: v.location, isAllDay: v.allDay, ...eventRange(v), updatedAt: now() }).where(eq(calendarEvents.id, id)),
    ...(await linkedContactWrites('event', id, v.contactName)),
  ]);
}

export async function deleteEvent(id: string) {
  const t = now();
  await db.update(calendarEvents).set({ deletedAt: t, updatedAt: t }).where(eq(calendarEvents.id, id));
}

/** Drag-drop on the timeline: move an event or task to a new time on the same day. */
export async function moveItem(item: CalItem, start: string, end: string) {
  if (item.kind === 'task') {
    const task = await getTask(item.id);
    if (task) await rescheduleTask(task, item.date, start, end);
    return;
  }
  const s = combineDateTime(item.date, start);
  const e = combineDateTime(item.date, end);
  if (s === undefined || e === undefined) return;
  await db.update(calendarEvents).set({ start: s, end: e, updatedAt: now() }).where(eq(calendarEvents.id, item.id));
}
