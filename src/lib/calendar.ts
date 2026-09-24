import { addDays, toDateKey } from './date';

/** Date จาก YYYY-MM-DD (local time) */
export function fromDateKey(key: string): Date {
  const [y, m, d] = key.split('-').map(Number);
  return new Date(y, m - 1, d);
}

export const shiftDateKey = (key: string, days: number): string => toDateKey(addDays(fromDateKey(key), days));

/** วันจันทร์ของสัปดาห์ที่มี key */
export function startOfWeek(key: string): string {
  const d = fromDateKey(key);
  return toDateKey(addDays(d, -((d.getDay() + 6) % 7)));
}

/** 7 วัน จันทร์–อาทิตย์ */
export function weekDays(key: string): string[] {
  const start = startOfWeek(key);
  return Array.from({ length: 7 }, (_, i) => shiftDateKey(start, i));
}

/** ตารางเดือน 6 แถว x 7 วัน เริ่มวันจันทร์ รวมวันของเดือนก่อน/ถัดไปเพื่อเติมช่อง */
export function monthGrid(key: string): string[][] {
  const d = fromDateKey(key);
  const first = toDateKey(new Date(d.getFullYear(), d.getMonth(), 1));
  const start = startOfWeek(first);
  return Array.from({ length: 6 }, (_, w) => Array.from({ length: 7 }, (_, i) => shiftDateKey(start, w * 7 + i)));
}

/** เลื่อนเดือน โดย clamp วันที่ (31 ม.ค. + 1 เดือน = 28/29 ก.พ.) */
export function shiftMonth(key: string, months: number): string {
  const d = fromDateKey(key);
  const target = new Date(d.getFullYear(), d.getMonth() + months, 1);
  const lastDay = new Date(target.getFullYear(), target.getMonth() + 1, 0).getDate();
  target.setDate(Math.min(d.getDate(), lastDay));
  return toDateKey(target);
}
