import { addDays, combineDateTime, toDateKey, toDateKeyUTC, utcDayStart } from '@/lib/date';

/** One thing on the calendar: a calendar event or a dated task. Times are local HH:mm. */
export type CalItem = {
  kind: 'event' | 'task';
  id: string;
  title: string;
  date: string;
  start?: string;
  end?: string;
  allDay: boolean;
  location?: string | null;
  done?: boolean;
  priority?: number;
  /** Synced from another calendar — edit it there, not here. */
  readOnly?: boolean;
  /** Linked-account colour for imported events (Google Calendar). */
  color?: string;
};

type EventRow = { id: string; title: string; start: number; end: number; isAllDay: boolean; location: string | null; source?: string; color?: string | null };
type TaskRow = { id: string; title: string; date: string | null; startTime: string | null; endTime: string | null; isDone: boolean; priority: number };

export const toMinutes = (hhmm: string) => {
  const [h, m] = hhmm.split(':').map(Number);
  return h * 60 + m;
};
export const fromMinutes = (mins: number) => `${String(Math.floor(mins / 60)).padStart(2, '0')}:${String(mins % 60).padStart(2, '0')}`;
export const hhmm = (d: Date) => fromMinutes(d.getHours() * 60 + d.getMinutes());

/** Parse a YYYY-MM-DD key as a local date. */
export const fromDateKey = (key: string) => {
  const [y, m, d] = key.split('-').map(Number);
  return new Date(y, m - 1, d);
};

const DAY_MS = 86_400_000;

/**
 * Date key of an all-day event boundary. New all-day events are stored as UTC midnight, which
 * reads back the same in every timezone. Older rows (and other writers) stored local midnight;
 * those are never an exact UTC-midnight multiple unless the offset was 0, so read them as local.
 */
export const allDayKey = (ms: number) => (ms % DAY_MS === 0 ? toDateKeyUTC(new Date(ms)) : toDateKey(new Date(ms)));

/**
 * Whether an event belongs in the dateKey range [from, to). All-day events match by date key and
 * include multi-day ones that overlap the range; timed events match by local start time.
 */
export function eventInRange(e: Pick<EventRow, 'start' | 'end' | 'isAllDay'>, from: string, to: string): boolean {
  if (e.isAllDay) {
    const first = allDayKey(e.start);
    // `end` is exclusive (the day after the last day).
    return first >= from ? first < to : allDayKey(e.end) > from;
  }
  return e.start >= fromDateKey(from).getTime() && e.start < fromDateKey(to).getTime();
}

/**
 * Event form values → stored epoch range. Timed events use local wall-clock time (DST-safe via
 * combineDateTime). All-day events use UTC midnight so their date survives timezone changes
 * (read back with `allDayKey`). Throws on an unparsable date/time.
 */
export function eventRange(v: { date: string; allDay: boolean; startTime: string; endTime: string }): { start: number; end: number } {
  const range = v.allDay
    ? { start: utcDayStart(v.date), end: utcDayStart(v.date, 1) }
    : { start: combineDateTime(v.date, v.startTime), end: combineDateTime(v.date, v.endTime) };
  if (range.start === undefined || range.end === undefined) throw new Error(`Invalid event date/time: ${v.date} ${v.startTime}-${v.endTime}`);
  return { start: range.start, end: range.end };
}

export function eventToItem(e: EventRow): CalItem {
  const start = new Date(e.start);
  const date = e.isAllDay ? allDayKey(e.start) : toDateKey(start);
  const readOnly = e.source !== undefined && e.source !== 'veyra';
  const color = e.color ?? undefined;
  if (e.isAllDay) return { kind: 'event', id: e.id, title: e.title, date, allDay: true, location: e.location, readOnly, color };
  const end = new Date(e.end);
  // Events that run past midnight are clipped to the end of their start day.
  const endStr = toDateKey(end) === date ? hhmm(end) : '23:59';
  return { kind: 'event', id: e.id, title: e.title, date, start: hhmm(start), end: endStr, allDay: false, location: e.location, readOnly, color };
}

/** Dated tasks appear on the calendar; untimed ones sit in the all-day row. Default length 30 min. */
export function taskToItem(t: TaskRow): CalItem | null {
  if (!t.date) return null;
  const base = { kind: 'task' as const, id: t.id, title: t.title, date: t.date, done: t.isDone, priority: t.priority };
  if (!t.startTime) return { ...base, allDay: true };
  const end = t.endTime && toMinutes(t.endTime) > toMinutes(t.startTime) ? t.endTime : fromMinutes(Math.min(toMinutes(t.startTime) + 30, 23 * 60 + 59));
  return { ...base, allDay: false, start: t.startTime, end };
}

export function mergeItems(events: EventRow[], tasks: TaskRow[]): CalItem[] {
  const items = [...events.map(eventToItem), ...tasks.map(taskToItem).filter((x): x is CalItem => !!x)];
  return items.sort(
    (a, b) =>
      a.date.localeCompare(b.date) ||
      Number(b.allDay) - Number(a.allDay) ||
      (a.start ?? '').localeCompare(b.start ?? '') ||
      (a.kind === b.kind ? 0 : a.kind === 'event' ? -1 : 1),
  );
}

export function itemsForDay(items: CalItem[], date: string) {
  const day = items.filter((i) => i.date === date);
  return { allDay: day.filter((i) => i.allDay), timed: day.filter((i) => !i.allDay) };
}

export function countByDay(items: CalItem[]) {
  const map = new Map<string, { events: number; tasks: number }>();
  for (const i of items) {
    const c = map.get(i.date) ?? { events: 0, tasks: 0 };
    if (i.kind === 'event') c.events++;
    else if (!i.done) c.tasks++;
    map.set(i.date, c);
  }
  return map;
}

/** Monday-first week containing `date`. */
export function weekDays(date: string): string[] {
  const d = fromDateKey(date);
  const monday = addDays(d, -((d.getDay() + 6) % 7));
  return Array.from({ length: 7 }, (_, i) => toDateKey(addDays(monday, i)));
}

/** 6×7 Monday-first grid for the month containing `date`. */
export function monthGrid(date: string): { date: string; inMonth: boolean }[] {
  const d = fromDateKey(date);
  const first = new Date(d.getFullYear(), d.getMonth(), 1);
  const start = addDays(first, -((first.getDay() + 6) % 7));
  return Array.from({ length: 42 }, (_, i) => {
    const day = addDays(start, i);
    return { date: toDateKey(day), inMonth: day.getMonth() === d.getMonth() };
  });
}

export function shiftDate(date: string, view: 'day' | 'week' | 'month', dir: 1 | -1): string {
  const d = fromDateKey(date);
  if (view === 'day') return toDateKey(addDays(d, dir));
  if (view === 'week') return toDateKey(addDays(d, 7 * dir));
  const target = new Date(d.getFullYear(), d.getMonth() + dir, 1);
  const lastDay = new Date(target.getFullYear(), target.getMonth() + 1, 0).getDate();
  return toDateKey(new Date(target.getFullYear(), target.getMonth(), Math.min(d.getDate(), lastDay)));
}

export type Positioned = CalItem & { top: number; height: number; col: number; cols: number };

/**
 * Lay timed items out on a vertical timeline. Overlapping items share the width
 * in columns (greedy, per overlap cluster). `hourHeight` px per hour from `startHour`.
 */
export function layoutTimeline(timed: CalItem[], startHour: number, hourHeight: number, minHeight = 28): Positioned[] {
  const sorted = [...timed].sort((a, b) => toMinutes(a.start!) - toMinutes(b.start!) || toMinutes(b.end!) - toMinutes(a.end!));
  const out: Positioned[] = [];
  let cluster: Positioned[] = [];
  let colEnds: number[] = [];
  let clusterEnd = -1;

  const flush = () => {
    const cols = colEnds.length;
    cluster.forEach((p) => (p.cols = cols));
    out.push(...cluster);
    cluster = [];
    colEnds = [];
  };

  for (const item of sorted) {
    const s = toMinutes(item.start!);
    const e = Math.max(toMinutes(item.end!), s + 15);
    if (s >= clusterEnd && cluster.length) flush();
    let col = colEnds.findIndex((end) => end <= s);
    if (col === -1) {
      col = colEnds.length;
      colEnds.push(e);
    } else colEnds[col] = e;
    clusterEnd = Math.max(clusterEnd, e);
    const top = ((s - startHour * 60) / 60) * hourHeight;
    cluster.push({ ...item, top, height: Math.max(((e - s) / 60) * hourHeight, minHeight), col, cols: 1 });
  }
  flush();
  return out;
}

export const SNAP_MIN = 15;
const LAST_MIN = 23 * 60 + 59;

/**
 * Drag on the timeline: shift a slot by `deltaMin`, snapped to 15 minutes and kept
 * inside the day. The length stays the same unless the day's end cuts it short.
 */
export function moveSlot(start: string, end: string, deltaMin: number): { start: string; end: string } {
  const s = toMinutes(start);
  const length = Math.max(toMinutes(end) - s, SNAP_MIN);
  const latest = 24 * 60 - length; // keep the whole slot inside the day
  const next = Math.min(Math.max(Math.round((s + deltaMin) / SNAP_MIN) * SNAP_MIN, 0), Math.min(latest, 24 * 60 - SNAP_MIN));
  return { start: fromMinutes(next), end: fromMinutes(Math.min(next + length, LAST_MIN)) };
}

/** Visible hour range: 07–21 by default, stretched to fit early/late items. */
export function hourRange(timed: CalItem[]): [number, number] {
  let start = 7;
  let end = 21;
  for (const i of timed) {
    start = Math.min(start, Math.floor(toMinutes(i.start!) / 60));
    end = Math.max(end, Math.ceil(toMinutes(i.end!) / 60));
  }
  return [start, Math.min(end, 24)];
}

/** Which timed item is happening now, and which is next (with minutes until it starts). */
export function scheduleStatus(timed: CalItem[], nowMins: number) {
  const current = timed.find((i) => toMinutes(i.start!) <= nowMins && nowMins < toMinutes(i.end!));
  const next = timed.find((i) => toMinutes(i.start!) > nowMins);
  return { currentId: current?.id, nextId: next?.id, nextIn: next ? toMinutes(next.start!) - nowMins : undefined };
}
