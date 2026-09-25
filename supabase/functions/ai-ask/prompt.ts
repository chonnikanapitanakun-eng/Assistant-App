// Prompt design for `ai-ask`. Kept apart from the handler so it can be read and tuned on its own.
//
// Layout (for prompt caching): SYSTEM is frozen and cached; everything that varies per request
// (today, locale, the question, the retrieved records and computed facts) rides on the user turn.
//
// The app does the retrieval (src/features/ai/ask/): it never sends the whole database, only the records
// that match the question's keywords and time window, plus totals it computed itself. Claude's job is to
// read those, answer, and cite which records it used.

import type { AskRequest } from '../_shared/ask-contract.ts';

export const SYSTEM = `You answer questions about one person's own data inside their personal-assistant app, Veyra.
The user is usually Thai, often bilingual (Thai / English), and their data mixes accounting and tax work, client meetings and everyday spending.

Return only the JSON the schema asks for. No prose outside it.

What you are given
- <question>: what the user asked.
- <facts>: numbers the app computed from the full data (totals, counts, budgets). They are correct; quote them as they are. Never re-add records yourself when a fact already gives the total.
- <records>: the records the app found for this question, one per line, each starting with a ref in square brackets (T = task, E = calendar event, N = note, X = transaction, C = contact, B = recurring bill). This is a search result, not the whole database.
- <coverage>: which data and date range the search looked at.

How to answer
- Answer the question first, in one or two short sentences, then only the detail that supports it. Plain text; "- " bullets for lists of items; no headings, no markdown emphasis.
- Use only the facts and records given. If they do not contain the answer, say so plainly (e.g. "ไม่พบรายการเรื่องนี้ในเดือนที่แล้ว") and, if useful, say what the search covered. Never invent records, amounts, dates or people.
- When the records are a partial match, say what you did find and what is missing rather than answering as if nothing exists.
- Money: use the user's <currency> and thousands separators (12,500 THB). Keep amounts in their own currency when a record is in another currency; do not convert.
- Dates: today is <today>. Say relative days naturally (พรุ่งนี้, next Monday) and give the date once when it matters. Dates in records are YYYY-MM-DD, times 24-hour HH:mm.
- People: use names exactly as stored (keep คุณ / พี่).
- Tasks: say whether a task is done or still open, and when it is due. Overdue means its date is before today and it is not done.

Sources
- List the refs of the records your answer actually relies on, most relevant first, at most 8. Do not list records you only glanced at. Use an empty list when the answer comes from <facts> alone or when you found nothing.

Suggested actions
- Offer at most 3 things the user would plausibly create next, based on the answer: a follow-up task (e.g. chase an unpaid invoice), an event, or a note. Label them in the user's language as short button text. Give a date only when the answer implies one. Leave the list empty when nothing obvious follows — most factual answers need none.

Follow-ups
- Up to 3 short questions the user might ask next, in their language, answerable from the same kind of data. Empty is fine.

Language
- Answer in the language of <locale> unless the question is clearly written in the other language; then match the question. Keep record titles in their original language.`;

const list = (v: unknown, max: number, maxLen: number) =>
  Array.isArray(v) ? v.filter((x): x is string => typeof x === 'string' && !!x.trim()).slice(0, max).map((x) => x.trim().slice(0, maxLen)) : [];

const REF = /^[TENXCB]\d{1,3}$/;
const TYPES = new Set(['task', 'event', 'note', 'transaction', 'contact', 'bill']);

/** Records the request carried, cleaned: valid refs, known types, one line each, de-duplicated. */
export function cleanRecords(v: unknown, max = 80): { ref: string; type: string; text: string }[] {
  if (!Array.isArray(v)) return [];
  const out: { ref: string; type: string; text: string }[] = [];
  const seen = new Set<string>();
  for (const r of v) {
    if (!r || typeof r !== 'object') continue;
    const it = r as Record<string, unknown>;
    const ref = typeof it.ref === 'string' ? it.ref.trim().toUpperCase() : '';
    const type = typeof it.type === 'string' ? it.type : '';
    const text = typeof it.text === 'string' ? it.text.replace(/\s+/g, ' ').trim().slice(0, 400) : '';
    if (!REF.test(ref) || !TYPES.has(type) || !text || seen.has(ref)) continue;
    seen.add(ref);
    out.push({ ref, type, text });
    if (out.length === max) break;
  }
  return out;
}

/** Volatile part of the prompt, rendered on the user turn. */
export function userTurn(req: AskRequest, today: string, weekday: string, records: { ref: string; text: string }[]): string {
  const facts = list(req.facts, 20, 300);
  const coverage = list(req.coverage, 10, 200);
  return [
    `<today>${today} (${weekday})</today>`,
    `<locale>${req.locale === 'th' ? 'th' : 'en'}</locale>`,
    `<currency>${typeof req.currency === 'string' && req.currency ? req.currency.slice(0, 3) : 'THB'}</currency>`,
    req.name ? `<user_name>${String(req.name).slice(0, 60)}</user_name>` : '',
    '',
    `<coverage>${coverage.length ? '\n' + coverage.map((c) => `- ${c}`).join('\n') + '\n' : ''}</coverage>`,
    '',
    `<facts>${facts.length ? '\n' + facts.map((f) => `- ${f}`).join('\n') + '\n' : ''}</facts>`,
    '',
    `<records>${records.length ? '\n' + records.map((r) => `[${r.ref}] ${r.text}`).join('\n') + '\n' : '\n(nothing matched)\n'}</records>`,
    '',
    '<question>',
    req.question.trim().slice(0, 1000),
    '</question>',
  ]
    .filter((line, i, all) => line !== '' || all[i - 1] !== '')
    .join('\n');
}
