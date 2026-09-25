/** YYYY-MM-DD ตาม local time */
export function toDateKey(d: Date = new Date()): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

/**
 * YYYY-MM-DD from the UTC calendar date. All-day events are stored as UTC midnight
 * (see `utcDayStart`) so their date does not shift when the device timezone changes.
 */
export function toDateKeyUTC(d: Date): string {
  const y = d.getUTCFullYear();
  const m = String(d.getUTCMonth() + 1).padStart(2, '0');
  const day = String(d.getUTCDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

/** Epoch ms of UTC midnight for a YYYY-MM-DD key, shifted by `addDaysN` whole days. undefined if unparsable. */
export function utcDayStart(dateKey: string, addDaysN = 0): number | undefined {
  const [y, m, d] = dateKey.split('-').map(Number);
  if ([y, m, d].some((n) => !Number.isFinite(n))) return undefined;
  return Date.UTC(y, m - 1, d + addDaysN);
}

/** YYYY-MM สำหรับ query รายเดือน */
export function toMonthKey(d: Date = new Date()): string {
  return toDateKey(d).slice(0, 7);
}

export function addDays(d: Date, n: number): Date {
  const r = new Date(d);
  r.setDate(r.getDate() + n);
  return r;
}

/** รวม date (YYYY-MM-DD) + time (HH:mm) เป็น epoch ms ตาม local time, คืน undefined ถ้าข้อมูลไม่ครบหรือ parse ไม่ได้ */
export function combineDateTime(date?: string, time?: string): number | undefined {
  if (!date || !time) return undefined;
  const [y, m, d] = date.split('-').map(Number);
  const [h, min] = time.split(':').map(Number);
  if ([y, m, d, h, min].some((n) => !Number.isFinite(n))) return undefined;
  return new Date(y, m - 1, d, h, min).getTime();
}

/** ค.ศ. → พ.ศ. */
export const toBuddhistYear = (year: number): number => year + 543;

export function greetingKey(d: Date = new Date()): 'greeting_morning' | 'greeting_afternoon' | 'greeting_evening' {
  const h = d.getHours();
  if (h < 12) return 'greeting_morning';
  if (h < 17) return 'greeting_afternoon';
  return 'greeting_evening';
}

/** Whole days from `today` to a YYYY-MM-DD key (local time). */
export function daysFromToday(dateKey: string, today: Date = new Date()): number {
  const [y, m, d] = dateKey.split('-').map(Number);
  const a = new Date(y, m - 1, d).getTime();
  const b = new Date(today.getFullYear(), today.getMonth(), today.getDate()).getTime();
  return Math.round((a - b) / 86_400_000);
}
