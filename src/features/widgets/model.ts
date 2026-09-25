/**
 * Home / lock screen widgets (P3-06) — what the widgets show, as plain data.
 *
 * The app computes everything here (text already translated and formatted) and hands it to the
 * OS widget. Widgets can't read the database or run app code, so they only lay this out.
 * Pure: no DB or platform imports, so it can be unit-tested.
 */
import type { CalendarEvent, RecurringBill, Task } from '@/db';
import { nextDueDate } from '@/features/money/model';
import { addDays, combineDateTime, daysFromToday, toDateKey } from '@/lib/date';

export const WIDGET_NAME = 'VeyraToday';

export type WidgetInput = {
  tasks: Pick<Task, 'id' | 'title' | 'date' | 'startTime' | 'endTime' | 'isDone'>[];
  events: Pick<CalendarEvent, 'id' | 'title' | 'start' | 'end' | 'isAllDay'>[];
  bills: Pick<RecurringBill, 'id' | 'name' | 'amount' | 'currency' | 'dueDay' | 'dueMonth' | 'frequency' | 'paidThrough' | 'remindDaysBefore'>[];
};

/** Everything a widget needs, ready to display. Only strings and numbers (it crosses into native code). */
export type WidgetData = {
  nextLabel: string;
  /** Title of the next (or current) task/event today, or '' when there is none. */
  nextTitle: string;
  /** "15:00" (or "15:00 – 16:00"), '' when there is no next item. */
  nextTime: string;
  /** Shown instead of the next item when the rest of today is free. */
  emptyLabel: string;
  done: number;
  total: number;
  /** "3/5 done" */
  progressLabel: string;
  /** Soonest bill due within BILL_WINDOW_DAYS (or overdue); '' when none. */
  billName: string;
  /** "Due in 2 days · ฿1,200" */
  billDetail: string;
  captureLabel: string;
  /** Deep links: the next item, the bill, Quick Capture, and the app itself. */
  nextUrl: string;
  billUrl: string;
  captureUrl: string;
  openUrl: string;
};

export type WidgetStrings = {
  nextLabel: string;
  emptyLabel: string;
  progress: (done: number, total: number) => string;
  billDue: (days: number) => string;
  capture: string;
  money: (amount: number, currency: string) => string;
  time: (ms: number) => string;
};

export const SCHEME = 'veyra://';
export const BILL_WINDOW_DAYS = 7;
const MAX_ENTRIES = 24;

type Upcoming = { kind: 'task' | 'event'; id: string; title: string; start: number; end: number };

/** Today's timed, open tasks and timed events as [start, end) ranges. */
function timedItems(input: WidgetInput, today: string): Upcoming[] {
  const items: Upcoming[] = [];
  for (const t of input.tasks) {
    if (t.isDone || t.date !== today || !t.startTime) continue;
    const start = combineDateTime(t.date, t.startTime);
    if (start === undefined) continue;
    const end = (t.endTime ? combineDateTime(t.date, t.endTime) : undefined) ?? start + 30 * 60_000;
    items.push({ kind: 'task', id: t.id, title: t.title, start, end: Math.max(end, start + 60_000) });
  }
  for (const e of input.events) {
    if (e.isAllDay || toDateKey(new Date(e.start)) !== today) continue;
    items.push({ kind: 'event', id: e.id, title: e.title, start: e.start, end: Math.max(e.end, e.start + 60_000) });
  }
  return items.sort((a, b) => a.start - b.start || a.end - b.end);
}

/** The item happening now, else the next one to start today. */
export function nextItem(input: WidgetInput, at: number): Upcoming | null {
  return timedItems(input, toDateKey(new Date(at))).find((i) => i.end > at) ?? null;
}

/** Soonest unpaid bill due within the window (overdue ones count, soonest first). */
export function dueBill(input: WidgetInput, at: number) {
  const today = new Date(at);
  let best: { bill: WidgetInput['bills'][number]; days: number } | null = null;
  for (const bill of input.bills) {
    const days = daysFromToday(nextDueDate(bill, today), today);
    if (days > BILL_WINDOW_DAYS) continue;
    if (!best || days < best.days) best = { bill, days };
  }
  return best;
}

export function buildWidgetData(input: WidgetInput, at: number, s: WidgetStrings): WidgetData {
  const today = toDateKey(new Date(at));
  const todays = input.tasks.filter((t) => t.date === today);
  const done = todays.filter((t) => t.isDone).length;
  const next = nextItem(input, at);
  const bill = dueBill(input, at);
  return {
    nextLabel: s.nextLabel,
    nextTitle: next?.title ?? '',
    nextTime: next ? `${s.time(next.start)} – ${s.time(next.end)}` : '',
    emptyLabel: s.emptyLabel,
    done,
    total: todays.length,
    progressLabel: s.progress(done, todays.length),
    billName: bill?.bill.name ?? '',
    billDetail: bill ? `${s.billDue(bill.days)} · ${s.money(bill.bill.amount, bill.bill.currency)}` : '',
    captureLabel: s.capture,
    nextUrl: next ? `${SCHEME}${next.kind}/${next.id}` : `${SCHEME}calendar`,
    billUrl: bill ? `${SCHEME}bill/${bill.bill.id}` : `${SCHEME}money`,
    captureUrl: `${SCHEME}capture`,
    openUrl: SCHEME,
  };
}

/**
 * Times at which the widget's content changes on its own: now, whenever an item starts or ends,
 * and the next midnight (today's progress resets, bills move a day closer). Sorted, deduped, capped.
 */
export function timelineTimes(input: WidgetInput, from: number): number[] {
  const midnight = new Date(addDays(new Date(from), 1).setHours(0, 0, 0, 0)).getTime();
  const edges = timedItems(input, toDateKey(new Date(from))).flatMap((i) => [i.start, i.end]);
  const times = new Set([from, midnight, ...edges.filter((t) => t > from && t < midnight)]);
  return [...times].sort((a, b) => a - b).slice(0, MAX_ENTRIES);
}

/** One entry per change point, so the widget stays right without the app running. */
export function buildTimeline(input: WidgetInput, from: number, s: WidgetStrings): { at: number; data: WidgetData }[] {
  return timelineTimes(input, from).map((at) => ({ at, data: buildWidgetData(input, at, s) }));
}

/** The entry to show at `at`: the latest one that has started (or the first, if none has). */
export function entryAt<T extends { at: number }>(entries: T[], at: number): T | undefined {
  let pick = entries[0];
  for (const e of entries) if (e.at <= at) pick = e;
  return pick;
}
