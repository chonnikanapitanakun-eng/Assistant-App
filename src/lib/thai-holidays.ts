/**
 * วันหยุดราชการ/ธนาคารไทย — ข้อมูลอย่างเป็นทางการรายปี (ครม./ธปท.) ต้องอัปเดตทุกปลายปีสำหรับปีถัดไป
 * เมื่อ ครม. ประกาศ ปีที่ไม่มีข้อมูลในตารางนี้จะไม่แสดงวันหยุด (ยกเว้นไม่มีการ fallback แบบเดา เพราะวันหยุดจันทรคติ
 * (มาฆบูชา/วิสาขบูชา/อาสาฬหบูชา/เข้าพรรษา) และวันหยุดชดเชย/วันหยุดพิเศษ ประกาศเป็นปีต่อปีเท่านั้น)
 */
export type ThaiHoliday = {
  date: string; // YYYY-MM-DD
  nameTh: string;
  nameEn: string;
  /** true = วันหยุดชดเชย/วันหยุดพิเศษที่ ครม. เพิ่มเป็นกรณี ไม่ใช่วันสำคัญเดิม */
  substitution?: boolean;
};

const HOLIDAYS_2025: ThaiHoliday[] = [
  { date: '2025-01-01', nameTh: 'วันขึ้นปีใหม่', nameEn: "New Year's Day" },
  { date: '2025-02-12', nameTh: 'วันมาฆบูชา', nameEn: 'Makha Bucha Day' },
  { date: '2025-04-06', nameTh: 'วันจักรี', nameEn: 'Chakri Memorial Day' },
  { date: '2025-04-13', nameTh: 'วันสงกรานต์', nameEn: 'Songkran Festival' },
  { date: '2025-04-14', nameTh: 'วันสงกรานต์', nameEn: 'Songkran Festival' },
  { date: '2025-04-15', nameTh: 'วันสงกรานต์', nameEn: 'Songkran Festival' },
  { date: '2025-05-01', nameTh: 'วันแรงงานแห่งชาติ', nameEn: 'National Labour Day' },
  { date: '2025-05-04', nameTh: 'วันฉัตรมงคล', nameEn: 'Coronation Day' },
  { date: '2025-05-11', nameTh: 'วันวิสาขบูชา', nameEn: 'Visakha Bucha Day' },
  { date: '2025-05-12', nameTh: 'วันหยุดชดเชยวันวิสาขบูชา', nameEn: 'Substitution for Visakha Bucha Day', substitution: true },
  { date: '2025-06-02', nameTh: 'วันหยุดราชการเพิ่มเป็นกรณีพิเศษ', nameEn: 'Special additional public holiday', substitution: true },
  { date: '2025-06-03', nameTh: 'วันเฉลิมพระชนมพรรษาสมเด็จพระนางเจ้าสุทิดาฯ พระบรมราชินี', nameEn: "Queen Suthida's Birthday" },
  { date: '2025-07-10', nameTh: 'วันอาสาฬหบูชา', nameEn: 'Asalha Bucha Day' },
  { date: '2025-07-11', nameTh: 'วันเข้าพรรษา', nameEn: 'Buddhist Lent Day' },
  { date: '2025-07-28', nameTh: 'วันเฉลิมพระชนมพรรษาพระบาทสมเด็จพระวชิรเกล้าเจ้าอยู่หัว', nameEn: "King Vajiralongkorn's Birthday" },
  { date: '2025-08-11', nameTh: 'วันหยุดราชการเพิ่มเป็นกรณีพิเศษ', nameEn: 'Special additional public holiday', substitution: true },
  { date: '2025-08-12', nameTh: 'วันแม่แห่งชาติ', nameEn: "National Mother's Day" },
  { date: '2025-10-13', nameTh: 'วันคล้ายวันสวรรคตพระบาทสมเด็จพระบรมชนกาธิเบศรฯ', nameEn: 'King Bhumibol Memorial Day' },
  { date: '2025-10-23', nameTh: 'วันปิยมหาราช', nameEn: 'Chulalongkorn Day' },
  { date: '2025-12-05', nameTh: 'วันคล้ายวันพระบรมราชสมภพ ร.9 / วันชาติ / วันพ่อแห่งชาติ', nameEn: "King Bhumibol's Birthday / National Day / Father's Day" },
  { date: '2025-12-10', nameTh: 'วันรัฐธรรมนูญ', nameEn: 'Constitution Day' },
  { date: '2025-12-31', nameTh: 'วันสิ้นปี', nameEn: "New Year's Eve" },
];

const HOLIDAYS_2026: ThaiHoliday[] = [
  { date: '2026-01-01', nameTh: 'วันขึ้นปีใหม่', nameEn: "New Year's Day" },
  { date: '2026-01-02', nameTh: 'วันหยุดราชการเพิ่มเป็นกรณีพิเศษ', nameEn: 'Special additional public holiday', substitution: true },
  { date: '2026-03-03', nameTh: 'วันมาฆบูชา', nameEn: 'Makha Bucha Day' },
  { date: '2026-04-06', nameTh: 'วันจักรี', nameEn: 'Chakri Memorial Day' },
  { date: '2026-04-13', nameTh: 'วันสงกรานต์', nameEn: 'Songkran Festival' },
  { date: '2026-04-14', nameTh: 'วันสงกรานต์', nameEn: 'Songkran Festival' },
  { date: '2026-04-15', nameTh: 'วันสงกรานต์', nameEn: 'Songkran Festival' },
  { date: '2026-05-01', nameTh: 'วันแรงงานแห่งชาติ', nameEn: 'National Labour Day' },
  { date: '2026-05-04', nameTh: 'วันฉัตรมงคล', nameEn: 'Coronation Day' },
  { date: '2026-05-31', nameTh: 'วันวิสาขบูชา', nameEn: 'Visakha Bucha Day' },
  { date: '2026-06-01', nameTh: 'วันหยุดชดเชยวันวิสาขบูชา', nameEn: 'Substitution for Visakha Bucha Day', substitution: true },
  { date: '2026-06-03', nameTh: 'วันเฉลิมพระชนมพรรษาสมเด็จพระนางเจ้าสุทิดาฯ พระบรมราชินี', nameEn: "Queen Suthida's Birthday" },
  { date: '2026-07-28', nameTh: 'วันเฉลิมพระชนมพรรษาพระบาทสมเด็จพระวชิรเกล้าเจ้าอยู่หัว', nameEn: "King Vajiralongkorn's Birthday" },
  { date: '2026-07-29', nameTh: 'วันอาสาฬหบูชา', nameEn: 'Asalha Bucha Day' },
  { date: '2026-07-30', nameTh: 'วันเข้าพรรษา', nameEn: 'Buddhist Lent Day' },
  { date: '2026-08-12', nameTh: 'วันแม่แห่งชาติ', nameEn: "National Mother's Day" },
  { date: '2026-10-16', nameTh: 'วันหยุดราชการเพิ่มเป็นกรณีพิเศษ', nameEn: 'Special additional public holiday', substitution: true },
  { date: '2026-10-23', nameTh: 'วันปิยมหาราช', nameEn: 'Chulalongkorn Day' },
  { date: '2026-12-05', nameTh: 'วันคล้ายวันพระบรมราชสมภพ ร.9 / วันชาติ / วันพ่อแห่งชาติ', nameEn: "King Bhumibol's Birthday / National Day / Father's Day" },
  { date: '2026-12-07', nameTh: 'วันหยุดชดเชยวันพ่อแห่งชาติ', nameEn: "Substitution for Father's Day", substitution: true },
  { date: '2026-12-10', nameTh: 'วันรัฐธรรมนูญ', nameEn: 'Constitution Day' },
  { date: '2026-12-31', nameTh: 'วันสิ้นปี', nameEn: "New Year's Eve" },
];

const HOLIDAYS_BY_YEAR: Record<number, ThaiHoliday[]> = {
  2025: HOLIDAYS_2025,
  2026: HOLIDAYS_2026,
};

const holidayIndexByYear = new Map<number, Map<string, ThaiHoliday>>();

function indexForYear(year: number): Map<string, ThaiHoliday> {
  let index = holidayIndexByYear.get(year);
  if (!index) {
    index = new Map((HOLIDAYS_BY_YEAR[year] ?? []).map((h) => [h.date, h]));
    holidayIndexByYear.set(year, index);
  }
  return index;
}

/** รายการวันหยุดราชการไทยทั้งปี เรียงตามวันที่ (ว่างถ้ายังไม่มีข้อมูลปีนั้น) */
export function thaiHolidaysOfYear(year: number): ThaiHoliday[] {
  return HOLIDAYS_BY_YEAR[year] ?? [];
}

/** วันหยุดราชการไทยของวันที่ dateKey (YYYY-MM-DD) ถ้ามี */
export function thaiHolidayOnDate(dateKey: string): ThaiHoliday | undefined {
  const year = Number(dateKey.slice(0, 4));
  return indexForYear(year).get(dateKey);
}

export function isThaiHoliday(dateKey: string): boolean {
  return thaiHolidayOnDate(dateKey) !== undefined;
}
