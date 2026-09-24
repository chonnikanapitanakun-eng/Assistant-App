import { addDays, toDateKey } from '@/lib/date';

import type { CaptureItem } from './types';

/**
 * Offline rule-based parser. One sentence can yield several items, e.g.
 * "Meeting with John tomorrow at 10 about VAT £5,000" → event + money + contact.
 * The ai-capture Edge Function will replace this later; keep it as the offline fallback.
 */

type Match = { value: string; raw: string[] };

const incomeWords = /(รับเงิน|ได้เงิน|เงินเข้า|income|fee|ค่าบริการ|เงินเดือน|ปันผล|dividend|salary|paid me|refund|คืนเงิน)/i;
const meetingWords = /(meeting|meet|call|appointment|lunch with|dinner with|interview|ประชุม|นัด|โทร|คุยกับ|ประชุมกับ)/i;

// Currency marker before or after the number. A bare number only counts as money when no time is present.
// A number glued to letters (Q3, FY2026, A4) is never money.
const moneyRe = /(£|\$|€|฿)?\s*(?<![A-Za-z\d])(\d[\d,]*(?:\.\d+)?)\s*(k\b)?\s*(บาท|baht|thb|gbp|usd|eur|ปอนด์|ดอลลาร์|ดอลล่าร์|ยูโร)?/gi;
const currencyByMarker: Record<string, string> = {
  '£': 'GBP', $: 'USD', '€': 'EUR', '฿': 'THB',
  บาท: 'THB', baht: 'THB', thb: 'THB', gbp: 'GBP', usd: 'USD', eur: 'EUR',
  ปอนด์: 'GBP', ดอลลาร์: 'USD', ดอลล่าร์: 'USD', ยูโร: 'EUR',
};

const relativeDays: [RegExp, number][] = [
  [/\b(day after tomorrow)\b|มะรืน(?:นี้)?/i, 2],
  [/\btomorrow\b|พรุ่งนี้/i, 1],
  [/\btoday\b|\btonight\b|วันนี้|คืนนี้/i, 0],
];

const weekdays: [RegExp, number][] = [
  [/\b(sun|sunday)\b|(?:วัน)?อาทิตย์/i, 0],
  [/\b(mon|monday)\b|(?:วัน)?จันทร์/i, 1],
  [/\b(tue|tues|tuesday)\b|(?:วัน)?อังคาร/i, 2],
  [/\b(wed|wednesday)\b|(?:วัน)?พุธ/i, 3],
  [/\b(thu|thur|thurs|thursday)\b|(?:วัน)?พฤหัส(?:บดี)?/i, 4],
  [/\b(fri|friday)\b|(?:วัน)?ศุกร์/i, 5],
  [/\b(sat|saturday)\b|(?:วัน)?เสาร์/i, 6],
];

export function parseCaptureLocally(input: string, today: Date = new Date(), opts: { strictMoney?: boolean } = {}): CaptureItem[] {
  const text = input.trim();
  if (!text) return [];

  const date = parseDate(text, today);
  const time = parseTime(text);
  const hasWhen = !!(date || time);
  const withoutWhen = strip(text, [...(date?.raw ?? []), ...(time?.raw ?? [])]);

  // strictMoney: only amounts with a currency marker (used when scanning longer notes).
  const money = parseMoney(withoutWhen, hasWhen || !!opts.strictMoney);
  const contact = parseContact(text);
  const title = clean(strip(withoutWhen, money?.raw ?? []));

  const contactName = contact?.value;
  const items: CaptureItem[] = [];
  const dateKey = date?.value ?? toDateKey(today);

  if (hasWhen && title) {
    const isEvent = meetingWords.test(text) || !!contactName;
    items.push(
      isEvent
        ? { type: 'event', title, date: dateKey, startTime: time?.value, contactName }
        : { type: 'task', title, date: dateKey, startTime: time?.value, contactName },
    );
  }

  if (money) {
    items.push({
      type: incomeWords.test(text) ? 'income' : 'expense',
      amount: money.amount,
      currency: money.currency,
      note: title || undefined,
      date: date?.value,
      contactName,
    });
  }

  if (contactName && items.length) items.push({ type: 'contact', name: contactName });

  return items.length ? items : [{ type: 'note', body: text }];
}

function parseDate(text: string, today: Date): Match | null {
  for (const [re, offset] of relativeDays) {
    const m = text.match(re);
    if (m) return { value: toDateKey(addDays(today, offset)), raw: [m[0]] };
  }
  for (const [re, dow] of weekdays) {
    const m = text.match(re);
    if (m) return { value: toDateKey(addDays(today, (dow - today.getDay() + 7) % 7)), raw: [m[0]] };
  }
  return null;
}

function parseTime(text: string): Match | null {
  const hhmm = (h: number, m = 0) => `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;

  // 14:30 / 9.15 น.
  let m = text.match(/\b(\d{1,2})[:.](\d{2})\s*(น\.|am|pm)?/i);
  if (m && Number(m[1]) < 24 && Number(m[2]) < 60) {
    let h = Number(m[1]);
    if (m[3]?.toLowerCase() === 'pm' && h < 12) h += 12;
    return { value: hhmm(h, Number(m[2])), raw: [m[0]] };
  }
  // 2pm / 10 am
  m = text.match(/\b(\d{1,2})\s*(am|pm)\b/i);
  if (m) {
    let h = Number(m[1]) % 12;
    if (m[2].toLowerCase() === 'pm') h += 12;
    return { value: hhmm(h), raw: [m[0]] };
  }
  // บ่าย 2 (โมง)
  m = text.match(/บ่าย\s*(\d{1,2})\s*(?:โมง)?/);
  if (m) return { value: hhmm((Number(m[1]) % 12) + 12), raw: [m[0]] };
  // 10 โมง / 5 โมงเย็น
  m = text.match(/(\d{1,2})\s*โมง(เช้า|เย็น)?/);
  if (m) {
    let h = Number(m[1]);
    if ((m[2] === 'เย็น' && h < 12) || (!m[2] && h < 6)) h += 12;
    return { value: hhmm(h), raw: [m[0]] };
  }
  // at 10 — bare hours before 7 are read as afternoon
  m = text.match(/\bat\s+(\d{1,2})\b(?![:.,]?\d)/i);
  if (m && Number(m[1]) <= 12) {
    const h = Number(m[1]);
    return { value: hhmm(h < 7 ? h + 12 : h), raw: [m[0]] };
  }
  m = text.match(/\bnoon\b|ตอนเที่ยง|เที่ยงวัน/i);
  if (m) return { value: '12:00', raw: [m[0]] };
  return null;
}

function parseMoney(text: string, requireMarker: boolean): (Match & { amount: number; currency: string }) | null {
  for (const m of text.matchAll(moneyRe)) {
    const [raw, prefix, num, k, suffix] = m;
    const marker = prefix ?? suffix?.toLowerCase();
    if (requireMarker && !marker) continue;
    const amount = Number(num.replace(/,/g, '')) * (k ? 1000 : 1);
    if (!Number.isFinite(amount) || amount <= 0) continue;
    return { value: raw, raw: [raw.trim()], amount, currency: (marker && currencyByMarker[marker]) || 'THB' };
  }
  return null;
}

function parseContact(text: string): Match | null {
  // Verb in any case, name capitalised ("Call John", "meet Sarah").
  const en = text.match(/\b(?:[Ww]ith|[Cc]all|[Mm]eet|[Mm]eeting|[Ee]mail|[Rr]ing|[Aa]sk|[Rr]emind|[Pp]ay|[Ff]rom)\s+([A-Z][a-zA-Z'-]+)/);
  if (en) return { value: en[1], raw: [] };
  const th = text.match(/(?:กับ|โทรหา|นัด|ถาม|จ่าย)\s*((?:คุณ|พี่|น้อง)\s*[^\s\d]+)/);
  if (th) return { value: th[1].replace(/\s+/g, ''), raw: [] };
  return null;
}

function strip(text: string, parts: string[]): string {
  return parts.reduce((acc, p) => (p ? acc.replace(p, ' ') : acc), text);
}

function clean(text: string): string {
  return text
    .replace(/\s+/g, ' ')
    .replace(/\s+([,.;:])/g, '$1')
    .replace(/^[\s,.;:–—-]+|[\s,.;:–—-]+$/g, '')
    .replace(/\s+(about|for|on|at|re|เรื่อง)$/i, '')
    .trim();
}
