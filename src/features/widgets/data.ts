import { and, gte, inArray, isNull, lt } from 'drizzle-orm';

import { calendarEvents, db, recurringBills, tasks } from '@/db';
import i18n from '@/i18n';
import { formatMoney } from '@/lib/currency';
import { addDays, toDateKey } from '@/lib/date';

import type { WidgetInput, WidgetStrings } from './model';

/** Today's and tomorrow's tasks and events (a timeline crosses midnight), plus all live bills. */
export async function loadWidgetInput(at: number = Date.now()): Promise<WidgetInput> {
  const day = new Date(at);
  const dates = [toDateKey(day), toDateKey(addDays(day, 1))];
  const from = new Date(at).setHours(0, 0, 0, 0);
  const to = addDays(new Date(from), 2).getTime();
  const [taskRows, eventRows, billRows] = await Promise.all([
    db
      .select({ id: tasks.id, title: tasks.title, date: tasks.date, startTime: tasks.startTime, endTime: tasks.endTime, isDone: tasks.isDone })
      .from(tasks)
      .where(and(isNull(tasks.deletedAt), inArray(tasks.date, dates)))
      .all(),
    db
      .select({ id: calendarEvents.id, title: calendarEvents.title, start: calendarEvents.start, end: calendarEvents.end, isAllDay: calendarEvents.isAllDay })
      .from(calendarEvents)
      .where(and(isNull(calendarEvents.deletedAt), gte(calendarEvents.start, from), lt(calendarEvents.start, to)))
      .all(),
    db.select().from(recurringBills).where(isNull(recurringBills.deletedAt)).all(),
  ]);
  return { tasks: taskRows, events: eventRows, bills: billRows };
}

/** Widget text in the app's current language. */
export function widgetStrings(): WidgetStrings {
  const t = i18n.t.bind(i18n);
  const locale = i18n.language === 'th' ? 'th-TH' : 'en-GB';
  return {
    nextLabel: t('widgets.next_up'),
    emptyLabel: t('widgets.free'),
    progress: (done, total) => t('widgets.progress', { done, total }),
    billDue: (days) => (days < 0 ? t('widgets.bill_overdue') : days === 0 ? t('widgets.bill_today') : t('widgets.bill_in', { count: days })),
    capture: t('widgets.capture'),
    money: (amount, currency) => formatMoney(amount, currency, locale),
    time: (ms) => new Date(ms).toLocaleTimeString(locale, { hour: '2-digit', minute: '2-digit', hour12: false }),
  };
}
