import { and, eq, isNotNull, isNull } from 'drizzle-orm';
import * as Notifications from 'expo-notifications';
import { Platform } from 'react-native';

import { calendarEvents, db, type CalendarEvent } from '@/db';
import i18n from '@/i18n';
import { allDayKey } from '@/features/calendar/model';
import { combineDateTime, toDateKey } from '@/lib/date';
import { nextOccurrence, type RepeatRule } from '@/lib/recurrence';

import { ensurePermission } from './permissions';
import { REMINDER_CHANNEL_ID } from './setup';

const MIN = 60_000;
const PERIOD_DAYS: Record<RepeatRule, number> = { daily: 1, weekly: 7, monthly: 28, yearly: 365 };

type ReminderEvent = Pick<CalendarEvent, 'id' | 'title' | 'start' | 'isAllDay' | 'repeat' | 'remindBefore' | 'reminderNotificationId' | 'source'>;

/** When the reminder for the occurrence on `date` fires (all-day events: 09:00 that day). */
function reminderTime(e: ReminderEvent, date: string): number {
  const time = e.isAllDay ? '09:00' : new Date(e.start).toTimeString().slice(0, 5);
  return combineDateTime(date, time)! - (e.remindBefore ?? 0) * MIN;
}

type Plan = { at: number; trigger: Notifications.NotificationTriggerInput };

/**
 * What to schedule: a repeating trigger once the series is running (its components match every
 * occurrence), otherwise a one-off for the next reminder. One-offs are topped up on app start
 * by `resyncEventReminders`.
 */
export function planEventReminder(e: ReminderEvent, now = Date.now()): Plan | null {
  if (e.remindBefore === null || e.remindBefore === undefined) return null;
  // All-day rows are stored at UTC midnight (see calendar/model eventRange).
  const first = e.isAllDay ? allDayKey(e.start) : toDateKey(new Date(e.start));
  const once = (at: number): Plan | null => (at > now ? { at, trigger: { type: Notifications.SchedulableTriggerInputTypes.DATE, date: at, channelId: REMINDER_CHANNEL_ID } } : null);
  if (!e.repeat) return once(reminderTime(e, first));

  // Next occurrence whose reminder is still ahead (the reminder can fall before the day itself).
  let date = first;
  for (let n = 0; reminderTime(e, date) <= now && n < 5000; n++) date = nextOccurrence(first, e.repeat, date);
  const at = reminderTime(e, date);
  const d = new Date(at);
  const started = at - now <= PERIOD_DAYS[e.repeat] * 86_400_000 || date !== first;
  if (!started) return once(at);

  const hm = { hour: d.getHours(), minute: d.getMinutes(), channelId: REMINDER_CHANNEL_ID };
  const T = Notifications.SchedulableTriggerInputTypes;
  switch (e.repeat) {
    case 'daily':
      return { at, trigger: { type: T.DAILY, ...hm } };
    case 'weekly':
      return { at, trigger: { type: T.WEEKLY, weekday: d.getDay() + 1, ...hm } };
    case 'yearly':
      return { at, trigger: { type: T.YEARLY, day: d.getDate(), month: d.getMonth(), ...hm } };
    case 'monthly': {
      // Days 29–31 and reminders that cross into the previous month don't repeat cleanly.
      const day = Number(first.slice(8));
      const clean = day <= 28 && d.getDate() === day;
      return clean ? { at, trigger: { type: T.MONTHLY, day: d.getDate(), ...hm } } : once(at);
    }
  }
}

export async function cancelEventReminder(notificationId: string | null) {
  if (!notificationId) return;
  await Notifications.cancelScheduledNotificationAsync(notificationId).catch(() => undefined);
}

/** Keep an event's scheduled notification in line with its reminder setting. Never throws. */
export async function syncEventReminder(e: ReminderEvent): Promise<void> {
  if (Platform.OS === 'web' || e.source !== 'veyra') return;
  await cancelEventReminder(e.reminderNotificationId);
  const plan = planEventReminder(e);
  let notificationId: string | null = null;
  if (plan && (await ensurePermission()) === 'granted') {
    const time = e.isAllDay ? i18n.t('calendar.all_day') : new Date(e.start).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    notificationId = await Notifications.scheduleNotificationAsync({ content: { title: e.title, body: time, sound: true }, trigger: plan.trigger }).catch(() => null);
  }
  if (notificationId !== e.reminderNotificationId) {
    await db.update(calendarEvents).set({ reminderNotificationId: notificationId }).where(eq(calendarEvents.id, e.id));
  }
}

/** On app start: move repeating events' one-off reminders on to their next occurrence. */
export async function resyncEventReminders(): Promise<void> {
  if (Platform.OS === 'web') return;
  const rows = await db
    .select()
    .from(calendarEvents)
    .where(and(isNull(calendarEvents.deletedAt), eq(calendarEvents.source, 'veyra'), isNotNull(calendarEvents.remindBefore), isNotNull(calendarEvents.repeat)))
    .all();
  for (const e of rows) await syncEventReminder(e);
}
