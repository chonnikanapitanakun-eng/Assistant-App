/**
 * ai-ask retrieval — pure helpers (no DB) so they can be unit tested.
 *
 * Pipeline (SPEC §6.4: "retrieval ก่อน ไม่ส่งทั้ง DB"):
 *   question ─► planRetrieval() ─► { terms, window, focus }
 *            ─► retrieve.ts runs FTS per term + date-range queries + linked records
 *            ─► render*() turns rows into one compact line each
 *            ─► rankRecords() scores / caps them and assigns short refs (T1, E2 …)
 *            ─► moneyFacts() / taskFacts() compute the numbers the model must quote, not re-add
 *            ─► remote.ts sends { question, facts, records, coverage } to the `ai-ask` Edge Function
 */
import { addDays, daysFromToday, toDateKey } from '@/lib/date';

import type { AskRecordType } from '../types';

export type Focus = 'money' | 'tasks' | 'events' | 'notes' | 'contacts' | 'bills';
/** Inclusive date range (YYYY-MM-DD) the question is about, with the phrase that implied it. */
export type Window = { from: string; to: string; label: string };
export type RetrievalPlan = {
  /** Keywords for FTS, each searched on its own (OR); stop words and the time phrase removed. */
  terms: string[];
  window: Window | null;
  /** Kinds of data the question hints at; empty = no hint (search everything, small "now" snapshot). */
  focus: Focus[];
};

const MAX_TERMS = 6;
const hasThai = (s: string) => /[\u0E00-\u0E7F]/.test(s);
const charLength = (s: string) => [...s].length;

// ---------------------------------------------------------------------------------------------------
// Time window
// ---------------------------------------------------------------------------------------------------

const TH_MONTHS = ['มกราคม', 'กุมภาพันธ์', 'มีนาคม', 'เมษายน', 'พฤษภาคม', 'มิถุนายน', 'กรกฎาคม', 'สิงหาคม', 'กันยายน', 'ตุลาคม', 'พฤศจิกายน', 'ธันวาคม'];
const TH_MONTHS_SHORT = ['ม.ค.', 'ก.พ.', 'มี.ค.', 'เม.ย.', 'พ.ค.', 'มิ.ย.', 'ก.ค.', 'ส.ค.', 'ก.ย.', 'ต.ค.', 'พ.ย.', 'ธ.ค.'];
const EN_MONTHS = ['january', 'february', 'march', 'april', 'may', 'june', 'july', 'august', 'september', 'october', 'november', 'december'];

const monthWindow = (y: number, m: number, label: string): Window => ({ from: toDateKey(new Date(y, m, 1)), to: toDateKey(new Date(y, m + 1, 0)), label });
const dayWindow = (d: Date, label: string): Window => ({ from: toDateKey(d), to: toDateKey(d), label });
const weekWindow = (now: Date, offsetWeeks: number, label: string): Window => {
  const monday = addDays(now, -((now.getDay() + 6) % 7) + offsetWeeks * 7);
  return { from: toDateKey(monday), to: toDateKey(addDays(monday, 6)), label };
};
const yearWindow = (y: number, label: string): Window => ({ from: `${y}-01-01`, to: `${y}-12-31`, label });

/** Phrase → window. Longest / most specific patterns first so "เดือนที่แล้ว" wins over "เดือน". */
const TIME_PHRASES: { re: RegExp; make: (now: Date, m: RegExpMatchArray) => Window }[] = [
  { re: /(?:last|past|previous)\s+(\d{1,3})\s+days?|(\d{1,3})\s*วัน(?:ที่ผ่านมา|ล่าสุด|ที่แล้ว|ก่อน)/i, make: (now, m) => ({ from: toDateKey(addDays(now, -Number(m[1] ?? m[2]) + 1)), to: toDateKey(now), label: `last ${m[1] ?? m[2]} days` }) },
  { re: /(?:next)\s+(\d{1,3})\s+days?|(\d{1,3})\s*วัน(?:ข้างหน้า|ถัดไป|จากนี้)/i, make: (now, m) => ({ from: toDateKey(now), to: toDateKey(addDays(now, Number(m[1] ?? m[2]) - 1)), label: `next ${m[1] ?? m[2]} days` }) },
  { re: /เมื่อวาน(?:นี้)?|yesterday/i, make: (now) => dayWindow(addDays(now, -1), 'yesterday') },
  { re: /มะรืน(?:นี้)?|day after tomorrow/i, make: (now) => dayWindow(addDays(now, 2), 'day after tomorrow') },
  { re: /พรุ่งนี้|tomorrow/i, make: (now) => dayWindow(addDays(now, 1), 'tomorrow') },
  { re: /วันนี้|today|tonight/i, make: (now) => dayWindow(now, 'today') },
  { re: /(?:สัปดาห์|อาทิตย์)(?:ที่แล้ว|ก่อน|ที่ผ่านมา)|last week/i, make: (now) => weekWindow(now, -1, 'last week') },
  { re: /(?:สัปดาห์|อาทิตย์)หน้า|next week/i, make: (now) => weekWindow(now, 1, 'next week') },
  { re: /(?:สัปดาห์|อาทิตย์)นี้|this week/i, make: (now) => weekWindow(now, 0, 'this week') },
  { re: /เดือน(?:ที่แล้ว|ก่อน|ที่ผ่านมา)|last month/i, make: (now) => monthWindow(now.getFullYear(), now.getMonth() - 1, 'last month') },
  { re: /เดือนหน้า|next month/i, make: (now) => monthWindow(now.getFullYear(), now.getMonth() + 1, 'next month') },
  { re: /เดือนนี้|this month/i, make: (now) => monthWindow(now.getFullYear(), now.getMonth(), 'this month') },
  { re: /ปี(?:ที่แล้ว|ก่อน|ที่ผ่านมา)|last year/i, make: (now) => yearWindow(now.getFullYear() - 1, 'last year') },
  { re: /ปีหน้า|next year/i, make: (now) => yearWindow(now.getFullYear() + 1, 'next year') },
  { re: /ปีนี้|this year/i, make: (now) => yearWindow(now.getFullYear(), 'this year') },
];

/** A Thai or English month name, optionally followed by a year (ค.ศ. or พ.ศ.). */
function monthName(question: string, now: Date): { window: Window; match: string } | null {
  const lower = question.toLowerCase();
  const names: { name: string; month: number }[] = [
    ...TH_MONTHS.map((name, month) => ({ name, month })),
    ...TH_MONTHS_SHORT.map((name, month) => ({ name, month })),
    ...EN_MONTHS.map((name, month) => ({ name, month })),
    ...EN_MONTHS.map((name, month) => ({ name: name.slice(0, 3), month })),
  ].sort((a, b) => b.name.length - a.name.length);
  for (const { name, month } of names) {
    const isEn = /^[a-z]+$/.test(name);
    const re = new RegExp(`${isEn ? '\\b' : ''}${name.replace(/\./g, '\\.')}${isEn ? '\\b' : ''}\\s*(?:(\\d{4}))?`, 'i');
    const m = lower.match(re);
    if (!m) continue;
    if (name === 'may' && !m[1]) continue; // "may" is usually the modal verb unless a year follows
    let year = m[1] ? Number(m[1]) : now.getFullYear();
    if (year > 2400) year -= 543; // พ.ศ.
    return { window: monthWindow(year, month, `${EN_MONTHS[month]} ${year}`), match: m[0] };
  }
  return null;
}

/** The date range a question is about (null when it names none), plus the question with that phrase removed. */
export function detectWindow(question: string, now: Date): { window: Window | null; rest: string } {
  for (const { re, make } of TIME_PHRASES) {
    const m = question.match(re);
    if (m) return { window: make(now, m), rest: question.replace(re, ' ') };
  }
  const byName = monthName(question, now);
  if (byName) return { window: byName.window, rest: question.replace(new RegExp(byName.match.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i'), ' ') };
  return { window: null, rest: question };
}

// ---------------------------------------------------------------------------------------------------
// Focus + keywords
// ---------------------------------------------------------------------------------------------------

const FOCUS_WORDS: Record<Focus, string[]> = {
  money: ['ใช้เงิน', 'ใช้จ่าย', 'ค่าใช้จ่าย', 'รายจ่าย', 'รายรับ', 'รายได้', 'จ่ายไป', 'จ่ายเงิน', 'เงินเข้า', 'เงินออก', 'ยอดใช้', 'งบประมาณ', 'บาท', 'ปอนด์', 'spend', 'spent', 'spending', 'expense', 'expenses', 'income', 'paid', 'cost', 'budget', 'money', 'transaction', 'earned', 'revenue'],
  bills: ['บิล', 'ค่าสมาชิก', 'subscription', 'subscriptions', 'bill', 'bills', 'ค่างวด', 'ครบกำหนดจ่าย'],
  tasks: ['งาน', 'ต้องทำ', 'ค้าง', 'ยังไม่เสร็จ', 'เสร็จ', 'กำหนดส่ง', 'deadline', 'task', 'tasks', 'to do', 'todo', 'overdue', 'pending', 'due', 'finish', 'done'],
  events: ['นัด', 'ประชุม', 'มีตติ้ง', 'ตาราง', 'ปฏิทิน', 'meeting', 'meetings', 'event', 'events', 'appointment', 'appointments', 'calendar', 'schedule', 'call'],
  notes: ['โน้ต', 'โน๊ต', 'บันทึก', 'จดไว้', 'จด', 'note', 'notes', 'wrote', 'idea'],
  contacts: ['ติดต่อ', 'เบอร์', 'อีเมล', 'ลูกค้า', 'contact', 'email', 'phone', 'client', 'customer'],
};

/** Words that carry no search signal. Thai entries are removed as substrings (Thai has no word breaks). */
const TH_STOP = [
  'ใช้เงิน', 'ใช้จ่าย', 'จ่ายเงิน', 'จ่ายไป', 'จ่าย', 'ซื้อ', 'ใช้', 'เงิน',
  'เท่าไหร่', 'เท่าไร', 'เมื่อไหร่', 'เมื่อไร', 'อย่างไร', 'ยังไง', 'ที่ไหน', 'ทำไม', 'อะไรบ้าง', 'อะไร', 'ใครบ้าง', 'บ้าง', 'ไหม', 'มั้ย', 'หรือเปล่า', 'หรือยัง', 'รึเปล่า', 'รึยัง', 'กี่',
  'ช่วยดู', 'ช่วยบอก', 'ช่วยหา', 'ช่วย', 'หน่อย', 'ให้หน่อย', 'ครับ', 'ค่ะ', 'คะ', 'นะ', 'จ้า', 'จ๊ะ', 'ล่ะ', 'หรอ', 'เหรอ',
  'ฉัน', 'ผม', 'เรา', 'ดิฉัน', 'หนู', 'ของฉัน', 'ของผม', 'ของเรา', 'ตัวเอง',
  'ทั้งหมด', 'รวมแล้ว', 'รวม', 'สรุป', 'แสดง', 'ดูให้', 'บอกให้', 'อยากรู้', 'อยากดู', 'ขอดู', 'ขอ', 'ลิสต์', 'รายการ',
  'ที่ผ่านมา', 'ล่าสุด', 'ตอนนี้', 'ช่วง', 'ระหว่าง', 'ตั้งแต่', 'จนถึง', 'ถึง',
  'เกี่ยวกับ', 'เรื่อง', 'ของ', 'ให้', 'กับ', 'และ', 'หรือ', 'ใน', 'จาก', 'ไป', 'มา', 'แล้ว', 'ยัง', 'ได้', 'คือ', 'เป็น', 'ว่า', 'ก็', 'จะ', 'ต้อง', 'มี', 'ที่', 'อยู่', 'นี้', 'นั้น', 'ไหน', 'ใคร', 'บน', 'เพื่อ', 'โดย', 'อีก', 'เลย', 'ด้วย',
];
const TH_STOP_SORTED = [...TH_STOP].sort((a, b) => b.length - a.length);
const EN_STOP = new Set(
  'what when where who whom whose how much many why which is are was were be been do did does done the a an i my me mine we our us you your of to in on at for with and or have has had this that these those there any about show tell list please give find get me all total sum up left still yet again just also can could would should will shall than then so if it its into from by as not no yes ok okay hi hey thanks thank'.split(' '),
);
const MONEY_GENERIC = new Set(['เงิน', 'จ่าย', 'ใช้', 'ยอด', 'ค่า', 'spend', 'spent', 'spending', 'expense', 'expenses', 'income', 'money', 'cost', 'paid', 'pay', 'total', 'much']);

/** Data kinds the question hints at, by vocabulary. */
export function detectFocus(question: string): Focus[] {
  const lower = question.toLowerCase();
  const out: Focus[] = [];
  for (const focus of Object.keys(FOCUS_WORDS) as Focus[]) {
    if (FOCUS_WORDS[focus].some((w) => (hasThai(w) ? lower.includes(w) : new RegExp(`\\b${w}\\b`).test(lower)))) out.push(focus);
  }
  return out;
}

/** Keywords worth an FTS lookup: stop words, particles and generic money words removed, at most 6. */
export function extractTerms(text: string): string[] {
  const cleaned = text.toLowerCase().replace(/[?!,;:"'()[\]{}«»“”‘’…/\\|<>=+*^~`#$%&]/g, ' ');
  const terms: string[] = [];
  for (const token of cleaned.split(/\s+/).filter(Boolean)) {
    if (hasThai(token)) {
      // Thai has no word breaks: strip stop phrases as substrings (longest first), keep what remains.
      // Thai has no word breaks: cut stop words out wherever they occur (longest first). Slicing through a
      // content word (ของขวัญ → ขวัญ) is fine — the index matches substrings, so the fragment still finds it.
      let rest = token;
      for (const w of TH_STOP_SORTED) rest = rest.split(w).join(' ');
      // What is left of a generic money phrase ("ค่า", "ยอด") is not worth a lookup on its own.
      for (const piece of rest.split(/\s+/).filter(Boolean)) if (charLength(piece) >= 2 && !MONEY_GENERIC.has(piece)) terms.push(piece);
    } else {
      const word = token.replace(/^[.-]+|[.-]+$/g, '');
      if (word.length >= 2 && !EN_STOP.has(word) && !MONEY_GENERIC.has(word)) terms.push(word);
    }
  }
  return [...new Set(terms)].slice(0, MAX_TERMS);
}

/** Decide what to fetch for a question. `now` is the user's local time. */
export function planRetrieval(question: string, now: Date = new Date()): RetrievalPlan {
  const { window, rest } = detectWindow(question, now);
  return { terms: extractTerms(rest), window, focus: detectFocus(question) };
}

// ---------------------------------------------------------------------------------------------------
// Rendering rows to one line each
// ---------------------------------------------------------------------------------------------------

export type TaskRow = { id: string; title: string; notes: string | null; date: string | null; startTime: string | null; endTime: string | null; isDone: boolean; priority: number; checklist?: { text: string; done: boolean }[] | null };
export type EventRow = { id: string; title: string; start: number; end: number; isAllDay: boolean; location: string | null; calendarName: string | null };
export type NoteRow = { id: string; title: string; body: string; tags: string[] | null; pinned: boolean; updatedAt: number };
export type TxRow = { id: string; amount: number; currency: string; type: 'income' | 'expense' | 'transfer'; date: string; note: string | null; categoryId: string | null; walletId: string; toWalletId: string | null };
export type ContactRow = { id: string; name: string; company: string | null; role: string | null; email: string | null; phone: string | null; notes: string | null };
export type BillRow = { id: string; name: string; amount: number; currency: string; frequency: 'monthly' | 'yearly'; isSubscription: boolean; due: string; paidThrough: string | null };

export const fmtAmount = (n: number) => n.toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 2 });
const clip = (s: string | null | undefined, max: number) => {
  const flat = (s ?? '').replace(/\s+/g, ' ').trim();
  return charLength(flat) > max ? `${[...flat].slice(0, max).join('').trimEnd()}…` : flat;
};
const hhmm = (ms: number) => {
  const d = new Date(ms);
  return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
};
const PRIORITY = ['', 'high', 'normal', 'low'];

export function renderTask(t: TaskRow, today: Date): string {
  const when = t.date ? `${t.date}${t.startTime ? ` ${t.startTime}${t.endTime ? `-${t.endTime}` : ''}` : ''}` : 'no date';
  let state = t.isDone ? 'done' : 'open';
  if (!t.isDone && t.date) {
    const days = daysFromToday(t.date, today);
    if (days < 0) state = `open, overdue by ${-days} day${days === -1 ? '' : 's'}`;
    else if (days === 0) state = 'open, due today';
    else state = `open, due in ${days} day${days === 1 ? '' : 's'}`;
  }
  const parts = [`Task: ${clip(t.title, 120)}`, when, state, `priority ${PRIORITY[t.priority] ?? 'normal'}`];
  const list = t.checklist ?? [];
  if (list.length) parts.push(`checklist ${list.filter((c) => c.done).length}/${list.length} done`);
  if (t.notes) parts.push(`notes: ${clip(t.notes, 140)}`);
  return parts.join(' | ');
}

export function renderEvent(e: EventRow): string {
  const date = toDateKey(new Date(e.start));
  const when = e.isAllDay ? `${date} all-day` : `${date} ${hhmm(e.start)}-${toDateKey(new Date(e.end)) === date ? hhmm(e.end) : '23:59'}`;
  const parts = [`Event: ${clip(e.title, 120)}`, when];
  if (e.location) parts.push(`at ${clip(e.location, 80)}`);
  if (e.calendarName) parts.push(`calendar ${clip(e.calendarName, 40)}`);
  return parts.join(' | ');
}

export function renderNote(n: NoteRow): string {
  const parts = [`Note: ${clip(n.title, 100) || '(untitled)'}`, `updated ${toDateKey(new Date(n.updatedAt))}`];
  if (n.tags?.length) parts.push(`tags ${n.tags.slice(0, 6).join(', ')}`);
  if (n.pinned) parts.push('pinned');
  if (n.body) parts.push(clip(n.body, 240));
  return parts.join(' | ');
}

export function renderTx(t: TxRow, names: { category?: string; wallet?: string; toWallet?: string }): string {
  const kind = t.type === 'income' ? 'Income' : t.type === 'expense' ? 'Expense' : 'Transfer';
  const parts = [`${kind} ${fmtAmount(t.amount)} ${t.currency}`, t.date];
  if (t.note) parts.push(clip(t.note, 100));
  if (names.category) parts.push(`category ${names.category}`);
  if (names.wallet) parts.push(t.type === 'transfer' && names.toWallet ? `${names.wallet} → ${names.toWallet}` : `wallet ${names.wallet}`);
  return parts.join(' | ');
}

export function renderContact(c: ContactRow): string {
  const parts = [`Contact: ${clip(c.name, 80)}`];
  const org = [c.role, c.company].filter(Boolean).join(', ');
  if (org) parts.push(clip(org, 80));
  if (c.email) parts.push(c.email);
  if (c.phone) parts.push(c.phone);
  if (c.notes) parts.push(`notes: ${clip(c.notes, 120)}`);
  return parts.join(' | ');
}

export function renderBill(b: BillRow, today: Date): string {
  const days = daysFromToday(b.due, today);
  const due = days < 0 ? `overdue by ${-days} days` : days === 0 ? 'due today' : `due in ${days} days`;
  const parts = [`Bill: ${clip(b.name, 80)}`, `${fmtAmount(b.amount)} ${b.currency} ${b.frequency}`, `next ${b.due} (${due})`];
  if (b.isSubscription) parts.push('subscription');
  if (b.paidThrough) parts.push(`paid through ${b.paidThrough}`);
  return parts.join(' | ');
}

// ---------------------------------------------------------------------------------------------------
// Ranking, refs and budget
// ---------------------------------------------------------------------------------------------------

/** A retrieved row before it gets a ref. `score` accumulates across the sources that found it. */
export type Candidate = { type: AskRecordType; id: string; title: string; text: string; score: number; /** Sort key within equal scores: newer first. */ recency: number };
export type RankedRecord = Candidate & { ref: string };

export const REF_PREFIX: Record<AskRecordType, string> = { task: 'T', event: 'E', note: 'N', transaction: 'X', contact: 'C', bill: 'B' };
export const refKey = (type: AskRecordType, id: string) => `${type}:${id}`;

/** Per-type caps so one noisy type (transactions) cannot crowd out the rest. */
export const TYPE_CAPS: Record<AskRecordType, number> = { task: 20, event: 15, note: 8, transaction: 30, contact: 6, bill: 12 };
export const MAX_RECORDS = 60;
export const MAX_CHARS = 8000;

/** Merge a hit into the candidate map, adding its score when it was already found by another source. */
export function addCandidate(map: Map<string, Candidate>, c: Candidate): void {
  const key = refKey(c.type, c.id);
  const prev = map.get(key);
  if (prev) prev.score += c.score;
  else map.set(key, { ...c });
}

/**
 * Order by score (then recency), apply per-type caps and the overall count / character budget,
 * and hand out refs in the order the model will see them (T1, T2, E1 …).
 */
export function rankRecords(candidates: Iterable<Candidate>, limits = { maxRecords: MAX_RECORDS, maxChars: MAX_CHARS }): RankedRecord[] {
  const sorted = [...candidates].sort((a, b) => b.score - a.score || b.recency - a.recency);
  const perType = new Map<AskRecordType, number>();
  const kept: Candidate[] = [];
  let chars = 0;
  for (const c of sorted) {
    const n = perType.get(c.type) ?? 0;
    if (n >= TYPE_CAPS[c.type]) continue;
    if (kept.length >= limits.maxRecords || chars + c.text.length > limits.maxChars) continue;
    perType.set(c.type, n + 1);
    kept.push(c);
    chars += c.text.length;
  }
  // Group by type for the prompt (all tasks, then events …) — easier for the model to scan than interleaved.
  const order: AskRecordType[] = ['task', 'event', 'bill', 'transaction', 'contact', 'note'];
  const counter = new Map<AskRecordType, number>();
  return order.flatMap((type) =>
    kept
      .filter((c) => c.type === type)
      .map((c) => {
        const n = (counter.get(type) ?? 0) + 1;
        counter.set(type, n);
        return { ...c, ref: `${REF_PREFIX[type]}${n}` };
      }),
  );
}

// ---------------------------------------------------------------------------------------------------
// Facts the app computes itself (Claude quotes them; it never sums rows)
// ---------------------------------------------------------------------------------------------------

/** Income / expense totals for a set of transactions (already filtered to the window), per currency. */
export function moneyFacts(txs: TxRow[], label: string, primary: string, categoryName: (id: string | null) => string): string[] {
  if (!txs.length) return [`No transactions ${label}.`];
  const byCur = new Map<string, { income: number; expense: number; n: number }>();
  const byCat = new Map<string | null, number>();
  for (const t of txs) {
    if (t.type === 'transfer') continue;
    const cur = byCur.get(t.currency) ?? { income: 0, expense: 0, n: 0 };
    cur[t.type] += t.amount;
    cur.n += 1;
    byCur.set(t.currency, cur);
    if (t.type === 'expense' && t.currency === primary) byCat.set(t.categoryId, (byCat.get(t.categoryId) ?? 0) + t.amount);
  }
  const facts: string[] = [];
  const order = [primary, ...[...byCur.keys()].filter((c) => c !== primary).sort()];
  for (const cur of order) {
    const v = byCur.get(cur);
    if (!v) continue;
    facts.push(`${label}, ${cur}: expense ${fmtAmount(v.expense)}, income ${fmtAmount(v.income)}, net ${v.income - v.expense < 0 ? '-' : '+'}${fmtAmount(Math.abs(v.income - v.expense))} (${v.n} transactions, transfers excluded)`);
  }
  const cats = [...byCat.entries()].sort((a, b) => b[1] - a[1]).slice(0, 8);
  if (cats.length) facts.push(`Top expense categories ${label} (${primary}): ${cats.map(([id, total]) => `${categoryName(id)} ${fmtAmount(total)}`).join('; ')}`);
  return facts;
}

/** Open / overdue / done counts over a set of tasks (already filtered to the window or to "open"). */
export function taskFacts(tasks: TaskRow[], label: string, today: Date): string[] {
  if (!tasks.length) return [`No tasks ${label}.`];
  const open = tasks.filter((t) => !t.isDone);
  const overdue = open.filter((t) => t.date && daysFromToday(t.date, today) < 0).length;
  const dueToday = open.filter((t) => t.date && daysFromToday(t.date, today) === 0).length;
  const undated = open.filter((t) => !t.date).length;
  const parts = [`Tasks ${label}: ${tasks.length} total, ${open.length} open, ${tasks.length - open.length} done`];
  if (overdue) parts.push(`${overdue} overdue`);
  if (dueToday) parts.push(`${dueToday} due today`);
  if (undated) parts.push(`${undated} without a date`);
  return [parts.join('; ')];
}

/** Budget status per category for the month, when any category has a budget. */
export function budgetFacts(spent: { name: string; spent: number; budget: number | null }[], primary: string, label: string): string[] {
  const withBudget = spent.filter((c) => c.budget != null && c.budget > 0);
  if (!withBudget.length) return [];
  const over = withBudget.filter((c) => c.spent > c.budget!);
  const parts = withBudget.map((c) => `${c.name} ${fmtAmount(c.spent)}/${fmtAmount(c.budget!)}`);
  return [`Budgets ${label} (${primary}): ${parts.join('; ')}${over.length ? ` — over budget: ${over.map((c) => c.name).join(', ')}` : ''}`];
}
