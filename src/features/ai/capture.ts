import { addDays, toDateKey } from '@/lib/date';

import type { CaptureItem } from './types';

/**
 * Rule-based parser สำหรับ Phase 0 (ไม่ต้องใช้เน็ต)
 * ครอบคลุมเคสง่าย: "ข้าวเที่ยง 80", "£5,000 fee", "พรุ่งนี้ 10 โมง ประชุมลูกค้า"
 * Phase 1 จะแทนด้วย ai-capture Edge Function และเก็บตัวนี้ไว้เป็น offline fallback
 */

const currencyMap: [RegExp, string][] = [
  [/£/, 'GBP'],
  [/\$/, 'USD'],
  [/\b(gbp|ปอนด์)\b/i, 'GBP'],
  [/\b(usd|ดอลล่าร์|ดอลลาร์)\b/i, 'USD'],
];

const incomeWords = /(รับ|ได้เงิน|เงินเข้า|income|fee|ค่าบริการ|เงินเดือน|ปันผล|dividend|salary|paid me)/i;

const thaiHourWords: Record<string, number> = { 'เที่ยง': 12, 'เที่ยงคืน': 0 };

export function parseCaptureLocally(input: string, today: Date = new Date()): CaptureItem[] {
  const text = input.trim();
  if (!text) return [];

  const money = parseMoney(text);
  if (money) return [money];

  const task = parseTask(text, today);
  if (task) return [task];

  return [{ type: 'note', body: text }];
}

function parseMoney(text: string): CaptureItem | null {
  const m = text.match(/(?:£|\$)?\s*(\d[\d,]*(?:\.\d+)?)\s*(?:บาท|baht|฿|gbp|usd|ปอนด์)?/i);
  if (!m) return null;
  const amount = Number(m[1].replace(/,/g, ''));
  if (!Number.isFinite(amount) || amount <= 0) return null;

  // มีคำบอกเวลาชัดเจน (โมง, :) ให้ถือว่าเป็น task ไม่ใช่เงิน
  if (/\d\s*(โมง|:\d{2}|น\.|am\b|pm\b)/i.test(text)) return null;

  let currency = 'THB';
  for (const [re, code] of currencyMap) if (re.test(text)) currency = code;

  const note = text.replace(m[0], '').replace(/[£$฿]/g, '').trim();
  const type = incomeWords.test(text) ? 'income' : 'expense';
  return { type, amount, currency, note: note || undefined };
}

function parseTask(text: string, today: Date): CaptureItem | null {
  let date: string | undefined;
  let rest = text;

  const dayWords: [RegExp, number][] = [
    [/^(วันนี้|today)\s*/i, 0],
    [/^(พรุ่งนี้|tomorrow)\s*/i, 1],
    [/^(มะรืน|day after tomorrow)\s*/i, 2],
  ];
  for (const [re, offset] of dayWords) {
    if (re.test(rest)) {
      date = toDateKey(addDays(today, offset));
      rest = rest.replace(re, '');
      break;
    }
  }

  let startTime: string | undefined;
  const tm = rest.match(/(\d{1,2})(?::(\d{2}))?\s*(โมง(?:เช้า|เย็น)?|น\.|am|pm|:\d{2})?/i);
  const thaiWord = Object.keys(thaiHourWords).find((w) => rest.includes(w));
  if (thaiWord && !tm) {
    startTime = `${String(thaiHourWords[thaiWord]).padStart(2, '0')}:00`;
  } else if (tm && (tm[3] || tm[2])) {
    let h = Number(tm[1]);
    const min = tm[2] ?? '00';
    const suffix = (tm[3] ?? '').toLowerCase();
    if (suffix === 'pm' && h < 12) h += 12;
    if (suffix.includes('เย็น') && h < 12) h += 12;
    if (suffix.includes('โมง') && h < 6) h += 12; // "บ่าย 2 โมง" style
    startTime = `${String(h).padStart(2, '0')}:${min}`;
    rest = rest.replace(tm[0], '');
  }

  const title = rest.replace(/\s+/g, ' ').trim();
  if (!date && !startTime) return null;
  if (!title) return null;
  return { type: 'task', title, date: date ?? toDateKey(today), startTime };
}
