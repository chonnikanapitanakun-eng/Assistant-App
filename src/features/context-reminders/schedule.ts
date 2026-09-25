import { and, eq, gte, isNull, lt } from 'drizzle-orm';
import * as Notifications from 'expo-notifications';
import { Platform } from 'react-native';

import { calendarEvents, contacts, db, links, tasks } from '@/db';
import { getPermissionState } from '@/features/notifications';
import { REMINDER_CHANNEL_ID } from '@/features/notifications/setup';
import { readJSON, writeJSON } from '@/features/profile/storage';
import { useProfile } from '@/features/profile/store';
import i18n from '@/i18n';

import { LOOKAHEAD_DAYS, planContextReminders, reminderText, type ContextInput, type ContextStrings } from './model';

/** Ids of the notifications this module scheduled last time, so the next run can replace them. */
const SCHEDULED_KEY = 'veyra.context.scheduled';

/** Notification payload; the root layout opens Focus on the first task when it's tapped. */
export type ContextNotificationData = { kind: 'context'; taskId: string; eventId: string };

async function loadInput(now: number): Promise<ContextInput> {
  const [eventRows, taskRows, linkRows, contactRows] = await Promise.all([
    db
      .select({ id: calendarEvents.id, title: calendarEvents.title, start: calendarEvents.start, isAllDay: calendarEvents.isAllDay })
      .from(calendarEvents)
      .where(and(isNull(calendarEvents.deletedAt), gte(calendarEvents.start, now), lt(calendarEvents.start, now + (LOOKAHEAD_DAYS + 1) * 86_400_000)))
      .all(),
    db.select({ id: tasks.id, title: tasks.title, date: tasks.date, priority: tasks.priority }).from(tasks).where(and(isNull(tasks.deletedAt), eq(tasks.isDone, false))).all(),
    db.select({ fromType: links.fromType, fromId: links.fromId, toType: links.toType, toId: links.toId }).from(links).where(isNull(links.deletedAt)).all(),
    db.select({ id: contacts.id, name: contacts.name }).from(contacts).where(isNull(contacts.deletedAt)).all(),
  ]);
  return { events: eventRows, tasks: taskRows, links: linkRows, contacts: contactRows };
}

function strings(): ContextStrings {
  const t = i18n.t.bind(i18n);
  const locale = i18n.language === 'th' ? 'th-TH' : 'en-GB';
  return {
    title: (time, event, contact) => (contact ? t('context.title_with', { time, event, contact }) : t('context.title', { time, event })),
    bodyOne: (task) => t('context.body_one', { task }),
    bodyMany: (count, list) => t('context.body_many', { count, tasks: list }),
    time: (ms) => new Date(ms).toLocaleTimeString(locale, { hour: '2-digit', minute: '2-digit', hour12: false }),
  };
}

let queue: Promise<void> = Promise.resolve();

/**
 * Replace every scheduled context reminder with a fresh plan from the current data.
 * Never asks for permission (that's for the user's own actions) — without it, only cancels.
 * Runs one at a time, so overlapping calls can't schedule the same reminder twice.
 */
export function syncContextReminders(): Promise<void> {
  if (Platform.OS === 'web') return Promise.resolve();
  const run = queue.then(replaceAll);
  queue = run.catch(() => undefined);
  return run;
}

async function replaceAll(): Promise<void> {
  const previous = readJSON<string[]>(SCHEDULED_KEY) ?? [];
  await Promise.all(previous.map((id) => Notifications.cancelScheduledNotificationAsync(id).catch(() => undefined)));

  const scheduled: string[] = [];
  const lead = useProfile.getState().contextReminderMin;
  if (lead > 0 && (await getPermissionState()) === 'granted') {
    const now = Date.now();
    const s = strings();
    for (const r of planContextReminders(await loadInput(now), now, lead)) {
      const data: ContextNotificationData = { kind: 'context', taskId: r.tasks[0].id, eventId: r.eventId };
      const id = await Notifications.scheduleNotificationAsync({
        content: { ...reminderText(r, s), data, sound: true },
        trigger: { type: Notifications.SchedulableTriggerInputTypes.DATE, date: r.at, channelId: REMINDER_CHANNEL_ID },
      }).catch(() => null);
      if (id) scheduled.push(id);
    }
  }
  writeJSON(SCHEDULED_KEY, scheduled);
}
