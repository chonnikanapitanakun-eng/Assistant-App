/** Logic ของ timeline (pure, test ได้) — เวลาเก็บเป็น HH:mm, คำนวณเป็นนาทีจากเที่ยงคืน */

export const DAY_START_HOUR = 6;
export const DAY_END_HOUR = 24;
export const HOUR_HEIGHT = 64;
export const SNAP_MIN = 15;
export const DEFAULT_DURATION_MIN = 60;
export const MIN_BLOCK_MIN = 15;

export function timeToMinutes(time: string): number {
  const [h, m] = time.split(':').map(Number);
  return h * 60 + m;
}

export function minutesToTime(min: number): string {
  const h = Math.floor(min / 60);
  const m = min % 60;
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
}

export const snap = (min: number, step = SNAP_MIN): number => Math.round(min / step) * step;

const dayStartMin = DAY_START_HOUR * 60;
const dayEndMin = DAY_END_HOUR * 60;

export const minutesToY = (min: number): number => ((min - dayStartMin) / 60) * HOUR_HEIGHT;
export const yToMinutes = (y: number): number => (y / HOUR_HEIGHT) * 60 + dayStartMin;

type Timed = { startTime: string | null; endTime: string | null; durationMin: number | null };

/** ช่วงเวลา (นาที) ของงาน ถ้าไม่มี end ใช้ durationMin หรือ default */
export function taskSpan(task: Timed): { start: number; end: number } | null {
  if (!task.startTime) return null;
  const start = timeToMinutes(task.startTime);
  const end = task.endTime ? timeToMinutes(task.endTime) : start + (task.durationMin ?? DEFAULT_DURATION_MIN);
  return { start, end: Math.max(end, start + MIN_BLOCK_MIN) };
}

/** เลื่อนงานไป deltaMin นาที (snap + clamp ในกรอบวัน) คงความยาวเดิม — endTime ที่ข้ามเที่ยงคืนจะถูก cap ที่ 23:59 */
export function moveSpan(span: { start: number; end: number }, deltaMin: number): { startTime: string; endTime: string } {
  const length = span.end - span.start;
  const start = Math.min(Math.max(snap(span.start + deltaMin), dayStartMin), dayEndMin - Math.min(length, dayEndMin - dayStartMin));
  const end = Math.min(start + length, dayEndMin - 1);
  return { startTime: minutesToTime(start), endTime: minutesToTime(end) };
}

export type Positioned<T> = { item: T; start: number; end: number; column: number; columns: number };

/** จัดคอลัมน์ให้งานที่เวลาซ้อนกันวางข้างกัน (แบบ Google Calendar อย่างง่าย) */
export function layoutOverlaps<T extends Timed>(items: T[]): Positioned<T>[] {
  const spans = items
    .map((item) => ({ item, span: taskSpan(item) }))
    .filter((x): x is { item: T; span: { start: number; end: number } } => x.span !== null)
    .sort((a, b) => a.span.start - b.span.start || b.span.end - a.span.end);

  const result: Positioned<T>[] = [];
  let group: Positioned<T>[] = [];
  let groupEnd = -1;
  const flush = () => {
    const columns = Math.max(0, ...group.map((g) => g.column)) + 1;
    for (const g of group) g.columns = columns;
    result.push(...group);
    group = [];
  };

  for (const { item, span } of spans) {
    if (group.length && span.start >= groupEnd) flush();
    const taken = new Set(group.filter((g) => g.end > span.start).map((g) => g.column));
    let column = 0;
    while (taken.has(column)) column++;
    group.push({ item, start: span.start, end: span.end, column, columns: 1 });
    groupEnd = Math.max(groupEnd, span.end);
  }
  if (group.length) flush();
  return result;
}
