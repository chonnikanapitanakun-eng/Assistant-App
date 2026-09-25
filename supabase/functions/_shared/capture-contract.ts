// Contract of `ai-capture`, shared by the Edge Function and the app (mirror of src/features/ai/types.ts).
// Pure TypeScript — no Deno globals — so vitest can test it from the app side.

export type CaptureTask = { type: 'task'; title: string; date?: string; startTime?: string; endTime?: string; contactName?: string };
export type CaptureEvent = { type: 'event'; title: string; date: string; startTime?: string; endTime?: string; contactName?: string };
export type CaptureMoney = { type: 'expense' | 'income'; amount: number; currency: string; note?: string; categoryHint?: string; date?: string; contactName?: string };
export type CaptureNote = { type: 'note'; body: string };
export type CaptureContact = { type: 'contact'; name: string };
export type CaptureItem = CaptureTask | CaptureEvent | CaptureMoney | CaptureNote | CaptureContact;
export type CaptureResponse = { items: CaptureItem[]; confidence: number };

export const CURRENCIES = ['THB', 'GBP', 'USD', 'EUR'] as const;

const str = { type: 'string' } as const;
const date = { type: 'string', description: 'YYYY-MM-DD' } as const;
const time = { type: 'string', description: 'HH:mm, 24-hour' } as const;

/**
 * JSON schema Claude must fill (structured output). One object per detected thing.
 * Optional fields are nullable rather than omitted so the schema stays strict (`required` lists every key).
 * Structured output rejects minimum/maximum, maxItems and similar constraints with a 400, so limits
 * (8 items, confidence 0–1, date/time format) are enforced in normalizeCaptureResponse instead.
 */
export const CAPTURE_SCHEMA = {
  type: 'object',
  properties: {
    items: {
      type: 'array',
      description: 'At most 8 items',
      items: {
        type: 'object',
        properties: {
          type: { type: 'string', enum: ['task', 'event', 'expense', 'income', 'note', 'contact'] },
          title: { ...str, description: 'task/event: short title in the user\'s words; note: first line; contact: full name' },
          body: { anyOf: [str, { type: 'null' }], description: 'note only: full text' },
          date: { anyOf: [date, { type: 'null' }] },
          startTime: { anyOf: [time, { type: 'null' }] },
          endTime: { anyOf: [time, { type: 'null' }] },
          amount: { anyOf: [{ type: 'number' }, { type: 'null' }], description: 'expense/income: positive number' },
          currency: { anyOf: [{ type: 'string', enum: [...CURRENCIES] }, { type: 'null' }] },
          note: { anyOf: [str, { type: 'null' }], description: 'expense/income: what it was for' },
          categoryHint: { anyOf: [str, { type: 'null' }], description: 'expense/income: one of the category names given, or null' },
          contactName: { anyOf: [str, { type: 'null' }], description: 'person mentioned, exactly as written (keep คุณ/พี่)' },
        },
        required: ['type', 'title', 'body', 'date', 'startTime', 'endTime', 'amount', 'currency', 'note', 'categoryHint', 'contactName'],
        additionalProperties: false,
      },
    },
    confidence: { type: 'number', description: '0 to 1: how sure you are the items match what the user meant' },
  },
  required: ['items', 'confidence'],
  additionalProperties: false,
} as const;

const isDate = (v: unknown): v is string => typeof v === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(v);
const isTime = (v: unknown): v is string => typeof v === 'string' && /^([01]\d|2[0-3]):[0-5]\d$/.test(v);
const text = (v: unknown): string => (typeof v === 'string' ? v.replace(/\s+/g, ' ').trim() : '');
const opt = (v: unknown): string | undefined => text(v) || undefined;

/** `end` (HH:mm) only when there is a `start` and `end` comes after it; otherwise the end time is dropped. */
export const endAfter = (start: string | undefined, end: string | undefined): string | undefined => (start && end && end > start ? end : undefined);

/**
 * Turn Claude's raw output into the app contract: drop unusable items, strip nulls,
 * de-duplicate contacts and make sure every contactName has a contact item.
 * Never throws — a bad response becomes `{ items: [], confidence: 0 }` and the app falls back locally.
 */
export function normalizeCaptureResponse(raw: unknown, opts: { defaultCurrency?: string; today?: string } = {}): CaptureResponse {
  const defaultCurrency = CURRENCIES.includes(opts.defaultCurrency as (typeof CURRENCIES)[number]) ? (opts.defaultCurrency as string) : 'THB';
  const input = raw && typeof raw === 'object' ? (raw as Record<string, unknown>) : {};
  const list = Array.isArray(input.items) ? input.items : [];
  const items: CaptureItem[] = [];
  const contacts = new Set<string>();

  const addContact = (name?: string) => {
    if (!name) return;
    const key = name.toLowerCase();
    if (contacts.has(key)) return;
    contacts.add(key);
    items.push({ type: 'contact', name });
  };

  for (const entry of list.slice(0, 8)) {
    if (!entry || typeof entry !== 'object') continue;
    const it = entry as Record<string, unknown>;
    const title = opt(it.title);
    const contactName = opt(it.contactName);
    const date = isDate(it.date) ? it.date : undefined;
    const startTime = isTime(it.startTime) ? it.startTime : undefined;
    const endTime = isTime(it.endTime) ? it.endTime : undefined;

    switch (it.type) {
      case 'task':
        if (!title) break;
        items.push({ type: 'task', title, date, startTime, endTime: endAfter(startTime, endTime), contactName });
        break;
      case 'event':
        if (!title) break;
        // An event needs a day; without one it is really a task.
        if (!date) items.push({ type: 'task', title, startTime, contactName });
        else items.push({ type: 'event', title, date, startTime, endTime: endAfter(startTime, endTime), contactName });
        break;
      case 'expense':
      case 'income': {
        const amount = typeof it.amount === 'number' ? it.amount : Number(it.amount);
        if (!Number.isFinite(amount) || amount <= 0) break;
        const currency = CURRENCIES.includes(it.currency as (typeof CURRENCIES)[number]) ? (it.currency as string) : defaultCurrency;
        items.push({ type: it.type, amount: Math.round(amount * 100) / 100, currency, note: opt(it.note) ?? title, categoryHint: opt(it.categoryHint), date, contactName });
        break;
      }
      case 'note': {
        const body = typeof it.body === 'string' && it.body.trim() ? it.body.trim() : title;
        if (body) items.push({ type: 'note', body });
        break;
      }
      case 'contact':
        addContact(opt(it.contactName) ?? title);
        break;
    }
  }

  // Contacts named on items but not listed separately still get saved (the app links them).
  for (const item of [...items]) if (item.type !== 'contact' && item.type !== 'note' && item.contactName) addContact(item.contactName);

  // Move contacts after the items that mention them, matching the offline parser's order.
  const ordered = [...items.filter((i) => i.type !== 'contact'), ...items.filter((i) => i.type === 'contact')];
  const c = typeof input.confidence === 'number' && Number.isFinite(input.confidence) ? input.confidence : 0;
  return { items: ordered, confidence: ordered.length ? Math.min(1, Math.max(0, c)) : 0 };
}
