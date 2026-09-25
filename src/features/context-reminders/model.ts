/**
 * Context-aware reminders (P3-07) — rule-based, fully offline.
 *
 * "15:00 meeting with John — VAT recon isn't done yet. Start Focus?"
 * Before each upcoming timed event, look for open tasks tied to it: linked to the event itself,
 * or linked to a contact who is on the event. If any, remind `leadMin` minutes before it starts.
 * Pure: no DB or platform imports.
 */
import type { CalendarEvent, Link, Task } from '@/db';
import { toDateKey } from '@/lib/date';

export type ContextInput = {
  events: Pick<CalendarEvent, 'id' | 'title' | 'start' | 'isAllDay'>[];
  /** Open (not done, not deleted) tasks. */
  tasks: Pick<Task, 'id' | 'title' | 'date' | 'priority'>[];
  links: Pick<Link, 'fromType' | 'fromId' | 'toType' | 'toId'>[];
  contacts: { id: string; name: string }[];
};

export type ContextReminder = {
  eventId: string;
  eventTitle: string;
  eventStart: number;
  /** When to notify (epoch ms). Always in the future. */
  at: number;
  /** First contact on the event, if any. */
  contactName: string | null;
  /** Unfinished prep, most relevant first (directly linked to the event, then by priority). */
  tasks: { id: string; title: string }[];
};

export const LEAD_OPTIONS = [0, 15, 30, 60] as const;
export type LeadMinutes = (typeof LEAD_OPTIONS)[number];
/** How far ahead to schedule, and at most how many (iOS keeps only 64 pending notifications in total). */
export const LOOKAHEAD_DAYS = 7;
export const MAX_REMINDERS = 10;

type Ref = { type: string; id: string };

/** Ids of `type` linked to `self`, in either direction. */
function linked(links: ContextInput['links'], self: Ref, type: string): string[] {
  const out: string[] = [];
  for (const l of links) {
    if (l.fromType === self.type && l.fromId === self.id && l.toType === type) out.push(l.toId);
    else if (l.toType === self.type && l.toId === self.id && l.fromType === type) out.push(l.fromId);
  }
  return out;
}

export function planContextReminders(input: ContextInput, now: number, leadMin: number, limit = MAX_REMINDERS): ContextReminder[] {
  if (leadMin <= 0) return [];
  const lead = leadMin * 60_000;
  const horizon = now + LOOKAHEAD_DAYS * 86_400_000;
  const taskById = new Map(input.tasks.map((t) => [t.id, t]));
  const contactById = new Map(input.contacts.map((c) => [c.id, c]));

  const plans: ContextReminder[] = [];
  for (const e of [...input.events].sort((a, b) => a.start - b.start)) {
    if (plans.length >= limit) break;
    const at = e.start - lead;
    // Past reminder times are skipped, never fired late: a refresh after one fired must not repeat it.
    if (e.isAllDay || at <= now || e.start > horizon) continue;
    const self = { type: 'event', id: e.id };
    const eventDay = toDateKey(new Date(e.start));

    const direct = new Set(linked(input.links, self, 'task'));
    const people = linked(input.links, self, 'contact').filter((id) => contactById.has(id));
    const viaPeople = new Set(people.flatMap((c) => linked(input.links, { type: 'contact', id: c }, 'task')));

    const prep = [...new Set([...direct, ...viaPeople])]
      .map((id) => taskById.get(id))
      // A task planned for after the meeting isn't prep for it.
      .filter((t): t is NonNullable<typeof t> => !!t && (!t.date || t.date <= eventDay))
      .sort((a, b) => Number(direct.has(b.id)) - Number(direct.has(a.id)) || a.priority - b.priority || a.title.localeCompare(b.title));
    if (!prep.length) continue;

    plans.push({
      eventId: e.id,
      eventTitle: e.title,
      eventStart: e.start,
      at,
      contactName: people.length ? contactById.get(people[0])!.name : null,
      tasks: prep.map((t) => ({ id: t.id, title: t.title })),
    });
  }
  return plans;
}

export type ContextStrings = {
  title: (time: string, event: string, contact: string | null) => string;
  bodyOne: (task: string) => string;
  bodyMany: (count: number, tasks: string) => string;
  time: (ms: number) => string;
};

/** Notification text for one reminder. Lists up to three task titles. */
export function reminderText(r: ContextReminder, s: ContextStrings): { title: string; body: string } {
  const contact = r.contactName && !r.eventTitle.toLowerCase().includes(r.contactName.toLowerCase()) ? r.contactName : null;
  const title = s.title(s.time(r.eventStart), r.eventTitle, contact);
  if (r.tasks.length === 1) return { title, body: s.bodyOne(r.tasks[0].title) };
  const shown = r.tasks.slice(0, 3).map((t) => t.title);
  const more = r.tasks.length - shown.length;
  return { title, body: s.bodyMany(r.tasks.length, more > 0 ? `${shown.join(', ')} +${more}` : shown.join(', ')) };
}
