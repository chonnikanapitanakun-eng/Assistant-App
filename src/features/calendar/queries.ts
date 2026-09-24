import { and, asc, eq, gte, isNull, lt } from 'drizzle-orm';

import { calendarEvents, commit, contacts, db, links, useDbQuery, useRows, type CalendarEvent } from '@/db';
import { linkedContactWrites } from '@/features/contacts/links';
import { getTask, rescheduleTask } from '@/features/tasks/queries';
import { newId, now } from '@/lib/ids';

import { fromDateKey, type CalItem } from './model';

const DAY = 86_400_000;

/** Live events starting within [from, to) — dateKeys, `to` exclusive. */
export function useEventsBetween(from: string, to: string): CalendarEvent[] {
  const a = fromDateKey(from).getTime();
  const b = fromDateKey(to).getTime();
  return useRows(db.select().from(calendarEvents).where(and(isNull(calendarEvents.deletedAt), gte(calendarEvents.start, a), lt(calendarEvents.start, b))).orderBy(asc(calendarEvents.start))).data;
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

function toRange(v: EventFormValues): { start: number; end: number } {
  const day = fromDateKey(v.date).getTime();
  if (v.allDay) return { start: day, end: day + DAY };
  const [sh, sm] = v.startTime.split(':').map(Number);
  const [eh, em] = v.endTime.split(':').map(Number);
  return { start: day + (sh * 60 + sm) * 60_000, end: day + (eh * 60 + em) * 60_000 };
}

export async function createEvent(v: EventFormValues): Promise<string> {
  const id = newId();
  const t = now();
  await commit([
    db.insert(calendarEvents).values({ id, externalId: id, source: 'veyra', title: v.title, location: v.location, isAllDay: v.allDay, ...toRange(v), createdAt: t, updatedAt: t }),
    ...(await linkedContactWrites('event', id, v.contactName)),
  ]);
  return id;
}

export async function updateEvent(id: string, v: EventFormValues) {
  await commit([
    db.update(calendarEvents).set({ title: v.title, location: v.location, isAllDay: v.allDay, ...toRange(v), updatedAt: now() }).where(eq(calendarEvents.id, id)),
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
  const day = fromDateKey(item.date).getTime();
  const at = (hhmm: string) => day + (Number(hhmm.slice(0, 2)) * 60 + Number(hhmm.slice(3))) * 60_000;
  await db.update(calendarEvents).set({ start: at(start), end: at(end), updatedAt: now() }).where(eq(calendarEvents.id, item.id));
}
