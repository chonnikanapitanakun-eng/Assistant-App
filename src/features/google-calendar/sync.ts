import { and, eq, inArray, isNull } from 'drizzle-orm';

import { calendarAccounts, calendarEvents, commit, db, type Write } from '@/db';
import { readJSON, writeJSON } from '@/features/profile/storage';
import { newId, now } from '@/lib/ids';

import { pickColor, planSync, syncWindow, type EventValues } from './model';
import { fetchSync, gcalEnabled } from './remote';
import type { AccountStatus } from './types';

const LAST_SYNC = 'gcal:lastSync';
const MIN_GAP_MS = 15 * 60_000;

let inFlight: Promise<void> | null = null;

/**
 * Pull every linked Google account's events into the local calendar (read-only rows).
 * Runs at most every 15 minutes unless `force` (Sync now / right after linking). Never overlaps.
 */
export function syncGoogleCalendars({ force = false } = {}): Promise<void> {
  if (!gcalEnabled) return Promise.resolve();
  if (!force && now() - (readJSON<number>(LAST_SYNC) ?? 0) < MIN_GAP_MS) return Promise.resolve();
  return (inFlight ??= run().finally(() => (inFlight = null)));
}

async function run() {
  const local = await db.select().from(calendarAccounts).where(isNull(calendarAccounts.deletedAt)).all();
  if (!local.length) return;

  const window = syncWindow();
  const accounts = await fetchSync(window.from, window.to);
  const t = now();
  const ids = accounts.map((a) => a.id);

  const existing = ids.length
    ? await db
        .select({ id: calendarEvents.id, accountId: calendarEvents.accountId, externalId: calendarEvents.externalId, calendarName: calendarEvents.calendarName, title: calendarEvents.title, location: calendarEvents.location, start: calendarEvents.start, end: calendarEvents.end, isAllDay: calendarEvents.isAllDay, deletedAt: calendarEvents.deletedAt })
        .from(calendarEvents)
        .where(and(eq(calendarEvents.source, 'google'), inArray(calendarEvents.accountId, ids)))
        .all()
    : [];
  const plan = planSync(accounts, existing.map((e) => ({ ...e, accountId: e.accountId ?? '' })), window);

  const colors = local.map((l) => l.color);
  const nextColor = () => {
    const c = pickColor(colors);
    colors.push(c);
    return c;
  };
  const row = (v: EventValues) => ({ ...v, source: 'google', updatedAt: t, deletedAt: null });
  const writes: Write[] = [
    ...plan.insert.map((v) => db.insert(calendarEvents).values({ id: newId(), createdAt: t, ...row(v) })),
    ...plan.update.map((u) => db.update(calendarEvents).set(row(u.values)).where(eq(calendarEvents.id, u.id))),
    ...(plan.remove.length ? [db.update(calendarEvents).set({ deletedAt: t, updatedAt: t }).where(inArray(calendarEvents.id, plan.remove))] : []),
    // Account list follows the server: new ones appear, ones removed elsewhere go.
    ...accounts.map((a) => {
      const known = local.find((l) => l.id === a.id);
      return known
        ? db.update(calendarAccounts).set({ email: a.email, status: a.status, updatedAt: t, ...(a.status === 'ok' ? { lastSyncedAt: t } : {}) }).where(eq(calendarAccounts.id, a.id))
        : upsertAccount(a.id, a.email, a.status, nextColor(), t);
    }),
    ...local.filter((l) => !ids.includes(l.id)).flatMap((l) => removeLocal(l.id, t)),
  ];
  await commit(writes);
  writeJSON(LAST_SYNC, t);
}

export function upsertAccount(id: string, email: string, status: AccountStatus, color: string, t = now()): Write {
  return db
    .insert(calendarAccounts)
    .values({ id, email, color, status, createdAt: t, updatedAt: t })
    .onConflictDoUpdate({ target: calendarAccounts.id, set: { email, status, deletedAt: null, updatedAt: t } });
}

/** Local side of unlinking: hide the account and its imported events. */
export function removeLocal(accountId: string, t = now()): Write[] {
  return [
    db.update(calendarEvents).set({ deletedAt: t, updatedAt: t }).where(and(eq(calendarEvents.accountId, accountId), isNull(calendarEvents.deletedAt))),
    db.update(calendarAccounts).set({ deletedAt: t, updatedAt: t }).where(eq(calendarAccounts.id, accountId)),
  ];
}
