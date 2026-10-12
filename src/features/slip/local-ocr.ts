import type { SlipResult } from './types';

/**
 * Slip OCR step 2 (on-device): ML Kit / Apple Vision text → amount, fee, date, time, ref.
 * Names and accounts are left for the user (or slip-ocr): device OCR reads Thai names poorly.
 * Pure — the native call lives in `readSlipLocal` so this stays testable.
 */

const TH_MONTHS = ['ม.ค.', 'ก.พ.', 'มี.ค.', 'เม.ย.', 'พ.ค.', 'มิ.ย.', 'ก.ค.', 'ส.ค.', 'ก.ย.', 'ต.ค.', 'พ.ย.', 'ธ.ค.'];
const TH_MONTHS_LONG = ['มกราคม', 'กุมภาพันธ์', 'มีนาคม', 'เมษายน', 'พฤษภาคม', 'มิถุนายน', 'กรกฎาคม', 'สิงหาคม', 'กันยายน', 'ตุลาคม', 'พฤศจิกายน', 'ธันวาคม'];
const EN_MONTHS = ['jan', 'feb', 'mar', 'apr', 'may', 'jun', 'jul', 'aug', 'sep', 'oct', 'nov', 'dec'];

const MONEY = /(\d{1,3}(?:,\d{3})+|\d+)\.(\d{2})(?!\d)/g;
const AMOUNT_LABEL = /จำนวน(?:เงิน)?|ยอด(?:เงิน|โอน|ชำระ)?|amount|total/i;
const FEE_LABEL = /ค่าธรรมเนียม|fee/i;
const REF_LABEL = /เลขที่รายการ|รหัสอ้างอิง|หมายเลขอ้างอิง|เลขอ้างอิง|transaction\s*(?:id|no)|ref(?:erence)?\s*(?:no|id|code)?/i;

const money = (s: string): number[] => [...s.matchAll(MONEY)].map((m) => Number(`${m[1].replace(/,/g, '')}.${m[2]}`));
const pad = (n: number) => String(n).padStart(2, '0');

/** Year as printed → CE. Thai slips print BE (2569 or 69); a 2-digit year ≥ 60 is read as BE. */
function toCE(raw: string, thai: boolean): number {
  let y = Number(raw);
  if (raw.length <= 2) y = thai || y >= 60 ? 2500 + y : 2000 + y;
  return y > 2400 ? y - 543 : y;
}

function validDate(y: number, m: number, d: number): string | undefined {
  if (m < 1 || m > 12 || d < 1 || d > 31 || y < 2000 || y > 2100) return undefined;
  const dt = new Date(Date.UTC(y, m - 1, d));
  return dt.getUTCDate() === d ? `${y}-${pad(m)}-${pad(d)}` : undefined;
}

export function findDate(text: string): string | undefined {
  const norm = text.replace(/\s+/g, ' ');
  for (const [list, thai] of [[TH_MONTHS, true], [TH_MONTHS_LONG, true]] as const) {
    for (let i = 0; i < 12; i++) {
      const esc = list[i].replace(/\./g, '\\.?\\s?');
      const m = norm.match(new RegExp(`(\\d{1,2})\\s*${esc}\\s*(\\d{4}|\\d{2})(?!\\d)`));
      if (m) {
        const d = validDate(toCE(m[2], thai), i + 1, Number(m[1]));
        if (d) return d;
      }
    }
  }
  const en = norm.match(/(\d{1,2})\s*([A-Za-z]{3})[a-z]*\.?,?\s*(\d{4}|\d{2})(?!\d)/);
  if (en) {
    const mi = EN_MONTHS.indexOf(en[2].toLowerCase());
    const d = mi >= 0 ? validDate(toCE(en[3], false), mi + 1, Number(en[1])) : undefined;
    if (d) return d;
  }
  const num = norm.match(/(\d{1,2})[/.-](\d{1,2})[/.-](\d{4}|\d{2})(?!\d)/);
  if (num) return validDate(toCE(num[3], false), Number(num[2]), Number(num[1]));
  return undefined;
}

export function parseSlipText(lines: string[]): SlipResult {
  const clean = lines.map((l) => l.trim()).filter(Boolean);
  const text = clean.join('\n');

  // Amount: the number on (or right after) an amount label; else the largest money figure.
  let amount: number | undefined;
  let fee: number | undefined;
  clean.forEach((line, i) => {
    const near = [line, clean[i + 1] ?? ''];
    if (fee === undefined && FEE_LABEL.test(line)) fee = near.flatMap(money)[0];
    else if (amount === undefined && AMOUNT_LABEL.test(line)) amount = near.flatMap(money).find((n) => n > 0);
  });
  if (amount === undefined) {
    const all = clean.filter((l) => !FEE_LABEL.test(l)).flatMap(money).filter((n) => n > 0);
    if (all.length) amount = Math.max(...all);
  }

  const t = text.match(/(?<!\d)([01]?\d|2[0-3]):([0-5]\d)(?::[0-5]\d)?(?!\d)/);
  const time = t ? `${pad(Number(t[1]))}:${t[2]}` : undefined;

  let ref: string | undefined;
  clean.forEach((line, i) => {
    if (ref || !REF_LABEL.test(line)) return;
    const after = `${line.replace(REF_LABEL, ' ')} ${clean[i + 1] ?? ''}`;
    ref = after.match(/[A-Za-z0-9]{10,}/)?.[0];
  });

  const date = findDate(text);
  return {
    isSlip: amount !== undefined && !!(date || time || ref),
    amount,
    fee,
    date,
    time,
    ref,
    from: {},
    to: {},
  };
}

/** Enough to save without a paid read: the amount and the date. */
export const isLocalComplete = (s: SlipResult): boolean => s.isSlip && s.amount !== undefined && !!s.date;

/** Run device OCR. Returns null when unsupported (web, Expo Go) or on any failure. */
export async function readSlipLocal(uri: string): Promise<SlipResult | null> {
  try {
    const { isSupported, extractTextFromImage } = await import('expo-text-extractor');
    if (!isSupported) return null;
    return parseSlipText(await extractTextFromImage(uri));
  } catch {
    return null;
  }
}
