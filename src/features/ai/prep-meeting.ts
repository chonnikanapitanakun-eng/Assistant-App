/**
 * ai-prep-meeting (P4-05) — the app side.
 *
 * 1. `buildPrepRequest(event)`  retrieval on-device: the event, its "with" contact and every record linked
 *    to it (docs/LINKS.md §4), plus earlier meetings with the same person. Only these leave the phone.
 * 2. `prepMeetingRemote(req)`   POST to the Edge Function (supabase/functions/ai-prep-meeting).
 * 3. `savePrepAsTask(...)`      after the user confirms: one task on the meeting day, the checklist as its
 *    checklist, linked to the event — so the brief is never written silently (SPEC §6.4).
 */
import { and, desc, eq, inArray, isNull, lt, ne } from 'drizzle-orm';

import { calendarEvents, contacts, db, links, notes, tasks, transactions, type CalendarEvent, type Contact } from '@/db';
import { getSession } from '@/features/auth';
import { eventToItem } from '@/features/calendar/model';
import { addLink } from '@/features/links/queries';
import { createTask } from '@/features/tasks/queries';
import { toDateKey } from '@/lib/date';
import { newId } from '@/lib/ids';

import type { PrepMeetingRequest, PrepMeetingResponse } from './types';

const url = process.env.EXPO_PUBLIC_SUPABASE_URL;
const anonKey = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY;

/** The brief needs Claude, so the button only appears when the Supabase project is configured. */
export const prepMeetingEnabled = !!url && !!anonKey;

const LIMITS = { notes: 8, tasks: 20, transactions: 20, pastEvents: 10 } as const;

/** Ids linked to `event`, grouped by the other end's type (both directions, live links only). */
async function linkedIds(eventId: string): Promise<{ contact: string[]; note: string[]; task: string[]; transaction: string[] }> {
  const rows = await db
    .select({ fromType: links.fromType, fromId: links.fromId, toType: links.toType, toId: links.toId })
    .from(links)
    .where(and(isNull(links.deletedAt), eq(links.fromType, 'event'), eq(links.fromId, eventId)))
    .all();
  const incoming = await db
    .select({ fromType: links.fromType, fromId: links.fromId, toType: links.toType, toId: links.toId })
    .from(links)
    .where(and(isNull(links.deletedAt), eq(links.toType, 'event'), eq(links.toId, eventId)))
    .all();
  const out = { contact: [] as string[], note: [] as string[], task: [] as string[], transaction: [] as string[] };
  for (const l of rows) if (l.toType in out) out[l.toType as keyof typeof out].push(l.toId);
  for (const l of incoming) if (l.fromType in out) out[l.fromType as keyof typeof out].push(l.fromId);
  return out;
}

/** Earlier meetings with the same contact (any relation), newest first. */
async function pastEventsWith(contactId: string, before: number, exceptId: string) {
  const rows = await db
    .select({ title: calendarEvents.title, start: calendarEvents.start })
    .from(links)
    .innerJoin(calendarEvents, eq(calendarEvents.id, links.fromId))
    .where(and(isNull(links.deletedAt), eq(links.fromType, 'event'), eq(links.toType, 'contact'), eq(links.toId, contactId), ne(calendarEvents.id, exceptId), isNull(calendarEvents.deletedAt), lt(calendarEvents.start, before)))
    .orderBy(desc(calendarEvents.start))
    .limit(LIMITS.pastEvents)
    .all();
  return rows.map((r) => ({ title: r.title, date: toDateKey(new Date(r.start)) }));
}

/** Everything the Edge Function may see for this meeting. Pure read; safe to call from a button. */
export async function buildPrepRequest(event: CalendarEvent, locale: 'th' | 'en'): Promise<PrepMeetingRequest> {
  const item = eventToItem(event);
  const ids = await linkedIds(event.id);

  let contact: Contact | undefined;
  if (ids.contact.length) contact = await db.select().from(contacts).where(and(inArray(contacts.id, ids.contact), isNull(contacts.deletedAt))).get();

  const [noteRows, taskRows, txRows, pastEvents] = await Promise.all([
    ids.note.length ? db.select().from(notes).where(and(inArray(notes.id, ids.note), isNull(notes.deletedAt))).orderBy(desc(notes.updatedAt)).limit(LIMITS.notes).all() : [],
    ids.task.length ? db.select().from(tasks).where(and(inArray(tasks.id, ids.task), isNull(tasks.deletedAt))).orderBy(tasks.isDone, desc(tasks.updatedAt)).limit(LIMITS.tasks).all() : [],
    ids.transaction.length ? db.select().from(transactions).where(and(inArray(transactions.id, ids.transaction), isNull(transactions.deletedAt))).orderBy(desc(transactions.date)).limit(LIMITS.transactions).all() : [],
    contact ? pastEventsWith(contact.id, event.start, event.id) : Promise.resolve([]),
  ]);

  return {
    locale,
    today: toDateKey(),
    event: { title: event.title, date: item.date, startTime: item.start ?? null, endTime: item.end ?? null, location: event.location, isAllDay: event.isAllDay },
    contact: contact ? { name: contact.name, company: contact.company, role: contact.role, notes: contact.notes } : null,
    notes: noteRows.map((n) => ({ title: n.title, body: n.body })),
    tasks: taskRows.map((t) => ({ title: t.title, isDone: t.isDone, date: t.date, notes: t.notes })),
    transactions: txRows.map((x) => ({ amount: x.amount, currency: x.currency, type: x.type, note: x.note, date: x.date })),
    pastEvents,
  };
}

const lines = (v: unknown): string[] => (Array.isArray(v) ? v.filter((x): x is string => typeof x === 'string' && !!x.trim()) : []);

/**
 * Ask the Edge Function for the brief. Throws on network / HTTP errors; resolves to an empty brief when
 * Claude declined or returned nothing, so the UI can show "couldn't prepare" with a retry.
 */
export async function prepMeetingRemote(req: PrepMeetingRequest, signal?: AbortSignal): Promise<PrepMeetingResponse> {
  const res = await fetch(`${url}/functions/v1/ai-prep-meeting`, {
    method: 'POST',
    // Signed in: the user's JWT, so ai_usage logs the real user_id (supabase/functions/_shared/usage.ts).
    headers: { 'content-type': 'application/json', authorization: `Bearer ${getSession()?.access_token ?? anonKey}`, apikey: anonKey! },
    signal,
    body: JSON.stringify(req),
  });
  if (!res.ok) throw new Error(`ai-prep-meeting ${res.status}`);
  const data = (await res.json()) as Partial<PrepMeetingResponse>;
  return { brief: typeof data.brief === 'string' ? data.brief.trim() : '', checklist: lines(data.checklist), agenda: lines(data.agenda) };
}

export const isEmptyPrep = (r: PrepMeetingResponse | null): boolean => !r || (!r.brief && !r.checklist.length && !r.agenda.length);

/**
 * Save the checklist as one "prepare for …" task on the meeting day (untimed, so it sits above the
 * timeline), with the agenda in its notes, and link it to the event. Returns the task id.
 */
export async function savePrepAsTask(event: CalendarEvent, prep: PrepMeetingResponse, title: string, agendaHeading: string): Promise<string> {
  const item = eventToItem(event);
  const agenda = prep.agenda.length ? `${agendaHeading}\n${prep.agenda.map((a, i) => `${i + 1}. ${a}`).join('\n')}` : null;
  const id = await createTask({
    title,
    notes: agenda,
    date: item.date,
    startTime: null,
    endTime: null,
    priority: 2,
    energy: null,
    areaId: null,
    isDone: false,
    checklist: prep.checklist.map((text) => ({ id: newId(), text, done: false })),
    remind: false,
  });
  await addLink({ type: 'task', id }, { type: 'event', id: event.id }, 'related');
  return id;
}
