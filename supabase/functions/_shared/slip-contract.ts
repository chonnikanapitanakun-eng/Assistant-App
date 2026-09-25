// Contract of `slip-ocr`, shared by the Edge Function and the app (mirror of src/features/slip/types.ts).
// Pure TypeScript — no Deno globals — so vitest can test it from the app side.

export type SlipParty = { name?: string; bankCode?: string; accountDigits?: string };
export type SlipResult = {
  isSlip: boolean;
  amount?: number;
  fee?: number;
  date?: string; // YYYY-MM-DD, Gregorian
  time?: string; // HH:mm
  ref?: string;
  from: SlipParty;
  to: SlipParty;
  memo?: string;
};

/**
 * Thai bank codes (Bank of Thailand) the model may answer with, plus TMN for TrueMoney Wallet (not a bank,
 * but slips name it the same way). Keep in sync with src/features/slip/banks.ts.
 */
export const BANK_CODES = ['002', '004', '006', '011', '014', '022', '024', '025', '030', '033', '034', '066', '067', '069', '073', '098', 'TMN'] as const;

const nullable = <T extends object>(s: T) => ({ anyOf: [s, { type: 'null' }] });
const str = { type: 'string' } as const;
const party = {
  type: 'object',
  properties: {
    name: nullable({ ...str, description: 'account holder / shop name exactly as printed (keep นาย/นาง/บจก.)' }),
    bank: nullable({ type: 'string', enum: [...BANK_CODES], description: 'bank code from the list, or null (shop, biller, unknown)' }),
    account: nullable({ ...str, description: 'account / PromptPay number as printed, masked digits included (e.g. xxx-x-x1234-x)' }),
  },
  required: ['name', 'bank', 'account'],
  additionalProperties: false,
} as const;

/**
 * JSON schema Claude must fill (structured output). Every key is required; unknown values are null.
 * Structured output rejects minimum/maximum and format keywords, so ranges are enforced in normalizeSlip.
 */
export const SLIP_SCHEMA = {
  type: 'object',
  properties: {
    isSlip: { type: 'boolean', description: 'false when the image is not a bank transfer / payment slip' },
    amount: nullable({ type: 'number', description: 'amount transferred, THB, positive, without fee' }),
    fee: nullable({ type: 'number' }),
    date: nullable({ ...str, description: 'YYYY-MM-DD in the Gregorian calendar (พ.ศ. − 543)' }),
    time: nullable({ ...str, description: 'HH:mm, 24-hour' }),
    ref: nullable({ ...str, description: 'transaction reference / เลขที่รายการ, as printed without spaces' }),
    from: party,
    to: party,
    memo: nullable({ ...str, description: 'บันทึกช่วยจำ / note typed by the payer, if any' }),
  },
  required: ['isSlip', 'amount', 'fee', 'date', 'time', 'ref', 'from', 'to', 'memo'],
  additionalProperties: false,
} as const;

const text = (v: unknown): string | undefined => (typeof v === 'string' ? v.replace(/\s+/g, ' ').trim() || undefined : undefined);
const money = (v: unknown): number | undefined => {
  const n = typeof v === 'number' ? v : typeof v === 'string' ? Number(v.replace(/[,\s฿]/g, '')) : NaN;
  return Number.isFinite(n) && n > 0 && n < 1e9 ? Math.round(n * 100) / 100 : undefined;
};

/** The longest run of digits in a masked account number: "xxx-x-x1234-x" → "1234". Under 3 digits is not useful. */
export function accountDigits(v: unknown): string | undefined {
  if (typeof v !== 'string') return undefined;
  const s = v.replace(/\s/g, '');
  // Nothing masked → the whole number (dashes only group it); masked → the longest visible run.
  const best = /^[\d-]+$/.test(s) ? s.replace(/-/g, '') : s.split(/\D+/).reduce((a, b) => (b.length > a.length ? b : a), '');
  return best.length >= 3 ? best : undefined;
}

/**
 * Accept YYYY-MM-DD in either era; Buddhist years (> 2400) become Gregorian. A short Buddhist year read
 * as 20YY ("25 ก.ย. 69" → 2069) is also caught: no slip is dated 2050 or later, so 20YY there means 25YY.
 */
export function normalizeDate(v: unknown): string | undefined {
  if (typeof v !== 'string') return undefined;
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(v.trim());
  if (!m) return undefined;
  let y = Number(m[1]);
  if (y > 2400) y -= 543;
  else if (y >= 2050 && y < 2100) y = y + 500 - 543;
  const mo = Number(m[2]);
  const d = Number(m[3]);
  if (y < 2000 || y > 2100 || mo < 1 || mo > 12 || d < 1 || d > 31) return undefined;
  return `${y}-${m[2]}-${m[3]}`;
}

function normalizeParty(raw: unknown): SlipParty {
  const p = raw && typeof raw === 'object' ? (raw as Record<string, unknown>) : {};
  const bank = typeof p.bank === 'string' && (BANK_CODES as readonly string[]).includes(p.bank) ? p.bank : undefined;
  return { name: text(p.name), bankCode: bank, accountDigits: accountDigits(p.account) };
}

/** Claude's raw output → the app contract. Never throws; unusable output becomes `{ isSlip: false }`. */
export function normalizeSlip(raw: unknown): SlipResult {
  const r = raw && typeof raw === 'object' ? (raw as Record<string, unknown>) : {};
  // Some slips print seconds (TrueMoney: 15:44:40); keep HH:mm.
  const time = typeof r.time === 'string' && /^([01]\d|2[0-3]):[0-5]\d(:[0-5]\d)?$/.test(r.time.trim()) ? r.time.trim().slice(0, 5) : undefined;
  const ref = text(r.ref)?.replace(/\s/g, '');
  const amount = money(r.amount);
  return {
    isSlip: r.isSlip === true && amount !== undefined,
    amount,
    fee: money(r.fee),
    date: normalizeDate(r.date),
    time,
    ref: ref && ref.length >= 6 ? ref : undefined,
    from: normalizeParty(r.from),
    to: normalizeParty(r.to),
    memo: text(r.memo),
  };
}
