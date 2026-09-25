// Contract of `ai-summary`, shared by the Edge Function and the app (mirror of src/features/ai/summary.ts).
// Pure TypeScript — no Deno globals — so vitest can test it from the app side.

export type SummaryScope = 'day' | 'week';

/** What the app sends: only the rows inside the range, already reduced to what the summary needs (SPEC §6.4). */
export type SummaryRequest = {
  scope: SummaryScope;
  locale?: 'th' | 'en';
  name?: string;
  today?: string; // YYYY-MM-DD (local to the user)
  weekday?: string; // e.g. Thursday
  from: string; // YYYY-MM-DD inclusive
  to: string; // YYYY-MM-DD inclusive
  currency?: string;
  tasks?: { title: string; date: string | null; startTime: string | null; isDone: boolean; priority: number; overdue?: boolean }[];
  events?: { title: string; date: string; start?: string; end?: string; allDay: boolean; location?: string | null }[];
  bills?: { name: string; amount: number; currency: string; due: string; state: 'overdue' | 'today' | 'soon' | 'later' }[];
  money?: { income: number; expense: number; currency: string; topCategories: { name: string; total: number }[]; overBudget: { name: string; spent: number; budget: number }[] };
  checkins?: { date: string; mood: number | null; energy: number | null; reflection: string | null }[];
};

export type SummaryResponse = {
  /** 2–4 short sentences in the user's language. */
  summary: string;
  /** Up to 5 positive or notable points. */
  highlights: string[];
  /** Up to 5 things that need action, most urgent first. */
  needsAttention: string[];
  /** One line (≤ 90 chars) fit for a notification body. */
  headline: string;
};

/**
 * JSON schema Claude must fill (structured output). Structured output rejects maxItems / maxLength,
 * so limits are enforced in normalizeSummaryResponse instead.
 */
export const SUMMARY_SCHEMA = {
  type: 'object',
  properties: {
    headline: { type: 'string', description: 'One line, at most 90 characters, no trailing period: the single most useful thing to know' },
    summary: { type: 'string', description: '2 to 4 short sentences, plain prose, no markdown, no headings' },
    highlights: { type: 'array', description: 'At most 5 short items', items: { type: 'string' } },
    needs_attention: { type: 'array', description: 'At most 5 short items, most urgent first; empty when nothing is pending', items: { type: 'string' } },
  },
  required: ['headline', 'summary', 'highlights', 'needs_attention'],
  additionalProperties: false,
} as const;

const MAX_ITEMS = 5;
const MAX_HEADLINE = 90;
const text = (v: unknown): string => (typeof v === 'string' ? v.replace(/\s+/g, ' ').trim() : '');
const list = (v: unknown): string[] => (Array.isArray(v) ? v.map(text).filter(Boolean).slice(0, MAX_ITEMS) : []);

/**
 * Turn Claude's raw output into the app contract. Never throws — a bad response becomes `null`,
 * and the app renders its rule-based summary instead.
 */
export function normalizeSummaryResponse(raw: unknown): SummaryResponse | null {
  const input = raw && typeof raw === 'object' ? (raw as Record<string, unknown>) : {};
  const summary = text(input.summary);
  if (!summary) return null;
  let headline = text(input.headline).replace(/[.。]+$/, '');
  if (!headline) headline = summary.split(/(?<=[.!?。])\s/)[0];
  if (headline.length > MAX_HEADLINE) headline = `${headline.slice(0, MAX_HEADLINE - 1).trimEnd()}…`;
  return { summary, highlights: list(input.highlights), needsAttention: list(input.needs_attention), headline };
}

/** Bound the request so a runaway client cannot push the prompt past what one call should cost. */
export function boundSummaryRequest(req: SummaryRequest): SummaryRequest {
  const cap = <T>(v: T[] | undefined, n: number): T[] => (Array.isArray(v) ? v.slice(0, n) : []);
  return {
    ...req,
    tasks: cap(req.tasks, 60),
    events: cap(req.events, 40),
    bills: cap(req.bills, 20),
    checkins: cap(req.checkins, 7),
    money: req.money ? { ...req.money, topCategories: cap(req.money.topCategories, 6), overBudget: cap(req.money.overBudget, 6) } : undefined,
  };
}
