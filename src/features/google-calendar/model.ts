import { fromDateKey } from '@/features/calendar/model';

import type { GoogleDate, SyncAccount } from './types';

const DAY = 86_400_000;

/** Sync window around today: 30 days back, 90 ahead (local midnights). */
export function syncWindow(today: Date = new Date()): { from: number; to: number } {
  const midnight = new Date(today.getFullYear(), today.getMonth(), today.getDate());
  return { from: new Date(midnight).setDate(midnight.getDate() - 30), to: new Date(midnight).setDate(midnight.getDate() + 90) };
}

/** Account colours: distinct from each other and readable as a 3px stripe in light and dark. */
export const ACCOUNT_COLORS = ['#6366F1', '#0EA5E9', '#10B981', '#F59E0B', '#EC4899', '#8B5CF6', '#EF4444', '#14B8A6'];

export function pickColor(used: string[]): string {
  return ACCOUNT_COLORS.find((c) => !used.includes(c)) ?? ACCOUNT_COLORS[used.length % ACCOUNT_COLORS.length];
}

/**
 * Google start/end → the epoch-ms range the calendar stores.
 * All-day dates become local midnights, the same as Veyra's own all-day events.
 */
export function toRange(start: GoogleDate, end: GoogleDate): { start: number; end: number; isAllDay: boolean } | null {
  if (start.date) {
    const s = fromDateKey(start.date).getTime();
    const e = end.date ? fromDateKey(end.date).getTime() : s + DAY;
    return Number.isFinite(s) ? { start: s, end: Math.max(e, s + 1), isAllDay: true } : null;
  }
  const s = Date.parse(start.dateTime ?? '');
  const e = Date.parse(end.dateTime ?? '');
  if (!Number.isFinite(s)) return null;
  return { start: s, end: Number.isFinite(e) && e > s ? e : s + 30 * 60_000, isAllDay: false };
}

export type EventValues = { accountId: string; externalId: string; calendarName: string | null; title: string; location: string | null; start: number; end: number; isAllDay: boolean };

/** Rows already on the device for the synced accounts (deleted ones included, so they can come back). */
export type ExistingEvent = EventValues & { id: string; deletedAt: number | null };

export type SyncPlan = {
  insert: EventValues[];
  update: { id: string; values: EventValues }[];
  remove: string[];
};

const same = (a: EventValues, b: EventValues) =>
  a.title === b.title && a.location === b.location && a.start === b.start && a.end === b.end && a.isAllDay === b.isAllDay && a.calendarName === b.calendarName;

/**
 * Diff what Google returned against what the device has.
 * - Only accounts that synced `ok` are touched; a failed / reauth account keeps its old events.
 * - Matching is by (account, Google id), so local ids — and links to them — survive every sync.
 * - An invite that shows up in two linked accounts appears once (first account wins).
 * - Events missing from Google are removed only inside the window that was fetched.
 */
export function planSync(accounts: SyncAccount[], existing: ExistingEvent[], window: { from: number; to: number }): SyncPlan {
  const plan: SyncPlan = { insert: [], update: [], remove: [] };
  const seen = new Set<string>();

  for (const account of accounts) {
    if (account.status !== 'ok') continue;
    const mine = new Map(existing.filter((e) => e.accountId === account.id).map((e) => [e.externalId, e]));
    const wanted = new Set<string>();

    for (const ev of account.events ?? []) {
      const range = toRange(ev.start, ev.end);
      if (!range) continue;
      const dedupeKey = ev.iCalUID ? `${ev.iCalUID}|${range.start}` : null;
      if (dedupeKey && seen.has(dedupeKey)) continue;
      if (dedupeKey) seen.add(dedupeKey);
      if (wanted.has(ev.id)) continue;
      wanted.add(ev.id);

      const values: EventValues = { accountId: account.id, externalId: ev.id, calendarName: ev.calendarName, title: ev.title.trim() || '(no title)', location: ev.location?.trim() || null, ...range };
      const row = mine.get(ev.id);
      if (!row) plan.insert.push(values);
      else if (row.deletedAt !== null || !same(row, values)) plan.update.push({ id: row.id, values });
    }

    for (const row of mine.values()) {
      if (row.deletedAt === null && !wanted.has(row.externalId) && row.start >= window.from && row.start < window.to) plan.remove.push(row.id);
    }
  }
  return plan;
}
