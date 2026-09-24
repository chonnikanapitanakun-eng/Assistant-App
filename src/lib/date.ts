/** YYYY-MM-DD ตาม local time */
export function toDateKey(d: Date = new Date()): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
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
