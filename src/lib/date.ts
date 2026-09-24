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
