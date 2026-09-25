// Contract of `ai-ask` (SPEC §6.4), shared by the Edge Function and the app (mirror of src/features/ai/types.ts).
// Pure TypeScript — no Deno globals — so vitest can test it from the app side.
//
// The app retrieves first (src/features/ai/ask/retrieve.ts) and sends only the records that match the
// question, each tagged with a short `ref` (T1, E2, N3, X4, C5, B6). Claude cites those refs as sources;
// anything it cites that was not in the request is dropped here, so the app never links to a record the
// model made up.

export type AskRecordType = 'task' | 'event' | 'note' | 'transaction' | 'contact' | 'bill';

/** One retrieved record, already rendered to a compact line by the app (it knows locale and currency). */
export type AskRecord = { ref: string; type: AskRecordType; text: string };

export type AskRequest = {
  question: string;
  locale?: 'th' | 'en';
  today?: string; // YYYY-MM-DD (local to the user)
  weekday?: string;
  currency?: string; // the user's primary currency
  name?: string;
  /** Numbers the app computed itself (totals, counts) — Claude must quote them rather than re-add rows. */
  facts?: string[];
  records?: AskRecord[];
  /** What the retrieval covered, so Claude can say "nothing for last month" instead of guessing. */
  coverage?: string[];
};

export type AskSuggestedAction = { label: string; type: 'task' | 'event' | 'note'; title: string; date?: string; startTime?: string };
export type AskSource = { ref: string };
export type AskResponse = {
  answer: string;
  sources: AskSource[];
  suggestedActions: AskSuggestedAction[];
  /** Short follow-up questions the user might tap next. */
  followUps: string[];
};

export const ASK_REF = /^[TENXCB]\d{1,3}$/;

const str = { type: 'string' } as const;
const nullable = (t: object) => ({ anyOf: [t, { type: 'null' }] }) as const;

/**
 * JSON schema Claude must fill (structured output). Structured output rejects maxItems / minimum-style
 * constraints with a 400, so limits (sources ≤ 8, actions ≤ 3, followUps ≤ 3) live in normalizeAskResponse.
 */
export const ASK_SCHEMA = {
  type: 'object',
  properties: {
    answer: { ...str, description: 'The answer, in the locale asked for. Plain text, short paragraphs or "- " bullets, no headings.' },
    sources: {
      type: 'array',
      description: 'Refs of the records the answer relies on (at most 8), most relevant first. Only refs that appear in <records>.',
      items: { type: 'object', properties: { ref: { ...str, description: 'e.g. T3' } }, required: ['ref'], additionalProperties: false },
    },
    suggestedActions: {
      type: 'array',
      description: 'At most 3 things the user might want to create next. Empty when nothing obvious follows.',
      items: {
        type: 'object',
        properties: {
          label: { ...str, description: 'Button text in the user\'s language, e.g. "เพิ่มงานตามลูกค้า"' },
          type: { type: 'string', enum: ['task', 'event', 'note'] },
          title: { ...str, description: 'Title of the task/event, or the note body' },
          date: nullable({ ...str, description: 'YYYY-MM-DD' }),
          startTime: nullable({ ...str, description: 'HH:mm, 24-hour' }),
        },
        required: ['label', 'type', 'title', 'date', 'startTime'],
        additionalProperties: false,
      },
    },
    followUps: { type: 'array', description: 'At most 3 short follow-up questions in the user\'s language, or empty.', items: str },
  },
  required: ['answer', 'sources', 'suggestedActions', 'followUps'],
  additionalProperties: false,
} as const;

const isDate = (v: unknown): v is string => typeof v === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(v);
const isTime = (v: unknown): v is string => typeof v === 'string' && /^([01]\d|2[0-3]):[0-5]\d$/.test(v);
const text = (v: unknown): string => (typeof v === 'string' ? v.replace(/[ \t]+/g, ' ').trim() : '');

/**
 * Turn Claude's raw output into the app contract: drop refs the request never sent, unusable actions and
 * over-long lists. Never throws — a bad response becomes an empty answer and the app shows its own message.
 */
export function normalizeAskResponse(raw: unknown, knownRefs: Iterable<string>): AskResponse {
  const known = new Set(knownRefs);
  const input = raw && typeof raw === 'object' ? (raw as Record<string, unknown>) : {};

  const sources: AskSource[] = [];
  const seen = new Set<string>();
  for (const s of Array.isArray(input.sources) ? input.sources : []) {
    const ref = s && typeof s === 'object' ? text((s as Record<string, unknown>).ref).toUpperCase() : '';
    if (!ASK_REF.test(ref) || !known.has(ref) || seen.has(ref)) continue;
    seen.add(ref);
    sources.push({ ref });
    if (sources.length === 8) break;
  }

  const suggestedActions: AskSuggestedAction[] = [];
  for (const a of Array.isArray(input.suggestedActions) ? input.suggestedActions : []) {
    if (!a || typeof a !== 'object') continue;
    const it = a as Record<string, unknown>;
    const label = text(it.label);
    const title = text(it.title);
    const type = it.type === 'task' || it.type === 'event' || it.type === 'note' ? it.type : null;
    if (!label || !title || !type) continue;
    const date = isDate(it.date) ? it.date : undefined;
    // An event needs a day; without one it is really a task.
    const kind = type === 'event' && !date ? 'task' : type;
    const startTime = kind !== 'note' && isTime(it.startTime) ? it.startTime : undefined;
    suggestedActions.push({ label, type: kind, title, ...(kind !== 'note' && date ? { date } : {}), ...(startTime ? { startTime } : {}) });
    if (suggestedActions.length === 3) break;
  }

  const followUps = (Array.isArray(input.followUps) ? input.followUps : [])
    .map(text)
    .filter((q, i, all) => q && all.indexOf(q) === i)
    .slice(0, 3);

  return { answer: typeof input.answer === 'string' ? input.answer.trim() : '', sources, suggestedActions, followUps };
}
