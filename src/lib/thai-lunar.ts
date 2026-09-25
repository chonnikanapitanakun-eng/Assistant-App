/** จำนวนวันเฉลี่ยต่อรอบดวงจันทร์ (synodic month) */
const SYNODIC_MONTH_DAYS = 29.530588853;

/** Julian Date ของวันเดือนดับ (new moon) ที่ทราบแน่ชัด: 2000-01-06 18:14 UTC */
const REFERENCE_NEW_MOON_JD = 2451550.09766;

const MS_PER_DAY = 86_400_000;

function toJulianDate(d: Date): number {
  return d.getTime() / MS_PER_DAY + 2440587.5;
}

/** อายุดวงจันทร์ (0 = เดือนดับ) ณ เที่ยงวันตามเวลาท้องถิ่นของวันนั้น */
function moonAge(d: Date): number {
  const noon = new Date(d.getFullYear(), d.getMonth(), d.getDate(), 12, 0, 0);
  const age = (toJulianDate(noon) - REFERENCE_NEW_MOON_JD) % SYNODIC_MONTH_DAYS;
  return age < 0 ? age + SYNODIC_MONTH_DAYS : age;
}

export type MoonPhase = 'new_moon' | 'waxing_quarter' | 'full_moon' | 'waning_quarter';

const QUARTERS: MoonPhase[] = ['new_moon', 'waxing_quarter', 'full_moon', 'waning_quarter'];
const QUARTER_STEP = SYNODIC_MONTH_DAYS / 4;

/**
 * วันพระ (Buddhist lunar observance day) ประมาณจากมุมของดวงจันทร์: ขึ้น 8 ค่ำ, ขึ้น 15 ค่ำ (เดือนเพ็ญ),
 * แรม 8 ค่ำ, แรม 14/15 ค่ำ (เดือนดับ) — เป็นการประมาณทางดาราศาสตร์ ใกล้เคียงปฏิทินจันทรคติไทยที่ประกาศจริง
 * แต่อาจคลาดเคลื่อนได้ ±1 วันในบางเดือน
 */
export function thaiMoonPhase(date: Date): MoonPhase | null {
  const age = moonAge(date);
  const steps = age / QUARTER_STEP;
  const nearestIndex = Math.round(steps) % QUARTERS.length;
  const distanceDays = Math.abs(steps - Math.round(steps)) * QUARTER_STEP;
  // ปฏิทินจันทรคติไทยนับวันตามเขตเวลาไทย ไม่ใช่ช่วงเวลาที่ดวงจันทร์เต็มดวงจริงตาม UTC จึงเผื่อคลาดเคลื่อนได้ ~1 วัน
  return distanceDays < 1.05 ? QUARTERS[nearestIndex] : null;
}

export function isWanPhra(date: Date): boolean {
  return thaiMoonPhase(date) !== null;
}

const moonPhaseCache = new Map<string, MoonPhase | null>();

/** เหมือน thaiMoonPhase แต่ cache ผลตาม date key เพื่อไม่คำนวณซ้ำเวลา render ทั้งเดือน */
export function thaiMoonPhaseForDateKey(dateKey: string): MoonPhase | null {
  const cached = moonPhaseCache.get(dateKey);
  if (cached !== undefined) return cached;
  const [y, m, d] = dateKey.split('-').map(Number);
  const phase = thaiMoonPhase(new Date(y, m - 1, d));
  moonPhaseCache.set(dateKey, phase);
  return phase;
}

export function isWanPhraDateKey(dateKey: string): boolean {
  return thaiMoonPhaseForDateKey(dateKey) !== null;
}
