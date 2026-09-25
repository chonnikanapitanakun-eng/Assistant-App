// Contract of `ai-prep-meeting` (SPEC §6.4, Phase 4), shared by the Edge Function and the app
// (mirror of src/features/ai/types.ts). Pure TypeScript — no Deno globals — so vitest can test it.

/** What the app sends: the event plus only the records linked to it (retrieval happens on-device). */
export type PrepMeetingRequest = {
  locale?: 'th' | 'en';
  today?: string; // YYYY-MM-DD, local to the user
  event: { title: string; date: string; startTime?: string | null; endTime?: string | null; location?: string | null; isAllDay?: boolean };
  contact?: { name: string; company?: string | null; role?: string | null; notes?: string | null } | null;
  notes?: { title: string; body: string }[];
  tasks?: { title: string; isDone: boolean; date?: string | null; notes?: string | null }[];
  transactions?: { amount: number; currency: string; type: string; note?: string | null; date: string }[];
  /** Earlier events with the same contact — gives the model the history of the relationship. */
  pastEvents?: { title: string; date: string }[];
  /** Threads with the contact (Gmail, P4-01). Not sent until that ships; the field is reserved so the prompt can use it. */
  emails?: { subject: string; from: string; date: string; snippet: string }[];
};

export type PrepMeetingResponse = {
  /** 2–4 short paragraphs: what the meeting is, where things stand, what to watch out for. */
  brief: string;
  /** Things to do or bring before the meeting. */
  checklist: string[];
  /** Suggested agenda, in order. */
  agenda: string[];
};

const str = { type: 'string' } as const;

/**
 * JSON schema Claude must fill (structured output). Limits (checklist ≤ 10, agenda ≤ 8, item length)
 * are enforced in normalizePrepMeeting — structured output rejects maxItems / maxLength with a 400.
 */
export const PREP_MEETING_SCHEMA = {
  type: 'object',
  properties: {
    brief: { ...str, description: 'Plain text, 2–4 short paragraphs separated by blank lines. No markdown headings or bullets.' },
    checklist: { type: 'array', description: 'At most 10 items. Each one an action the user can tick off before the meeting.', items: str },
    agenda: { type: 'array', description: 'At most 8 items, in the order to discuss them.', items: str },
  },
  required: ['brief', 'checklist', 'agenda'],
  additionalProperties: false,
} as const;

export const LIMITS = { checklist: 10, agenda: 8, item: 200, brief: 2500 } as const;

const line = (v: unknown): string => (typeof v === 'string' ? v.replace(/\s+/g, ' ').replace(/^[-*•\d.)\s]+/, '').trim() : '');

function lines(v: unknown, max: number): string[] {
  if (!Array.isArray(v)) return [];
  const out: string[] = [];
  const seen = new Set<string>();
  for (const item of v) {
    const text = line(item).slice(0, LIMITS.item);
    const key = text.toLowerCase();
    if (!text || seen.has(key)) continue;
    seen.add(key);
    out.push(text);
    if (out.length >= max) break;
  }
  return out;
}

/**
 * Turn Claude's raw output into the app contract: trim, drop empty / duplicate lines, cap lengths.
 * Never throws — a bad response becomes an empty brief, which the app treats as "nothing to show".
 */
export function normalizePrepMeeting(raw: unknown): PrepMeetingResponse {
  const input = raw && typeof raw === 'object' ? (raw as Record<string, unknown>) : {};
  const brief = typeof input.brief === 'string' ? input.brief.replace(/\r\n/g, '\n').replace(/[ \t]+\n/g, '\n').replace(/\n{3,}/g, '\n\n').trim().slice(0, LIMITS.brief) : '';
  return { brief, checklist: lines(input.checklist, LIMITS.checklist), agenda: lines(input.agenda, LIMITS.agenda) };
}

export const isEmptyPrep = (r: PrepMeetingResponse): boolean => !r.brief && !r.checklist.length && !r.agenda.length;
