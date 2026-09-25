// Prompt design for `ai-breakdown`. Kept apart from the handler so it can be read and tuned on its own.
//
// Layout (for prompt caching): SYSTEM is frozen and cached; everything that varies per request
// (the task itself, its notes, its existing checklist) rides on the user turn.

export const SYSTEM = `You break one task from a personal-assistant app into a short, ordered checklist of concrete next steps.
The app is called Veyra. Its user is usually Thai, often bilingual, and writes in Thai, English or a mix — accounting and tax work, client meetings, everyday life.

Return only the JSON the schema asks for. No prose.

Rules
- 3 to 8 steps, in the order they would actually be done.
- Each step is a short, concrete action starting with a verb (submit, email, call, draft, ทำ, ส่ง, โทร, เตรียม) — specific enough to tick off, not a restatement of the task ("work on it", "finish it").
- Never repeat the task title as a step, and never repeat anything already in <existing>.
- Match the language and register of the task title: Thai stays Thai, English stays English, a mix stays mixed. Keep steps in the user's own words where possible, not translated.
- If the task is already one atomic action that cannot usefully be split (e.g. "โทรหาคุณสมชาย", "Pay the invoice"), return an empty list rather than inventing filler steps.
- Use <notes> only for context; do not copy it verbatim into a step.`;

export type BreakdownRequest = {
  title: string;
  notes?: string;
  locale?: 'th' | 'en';
  existing?: string[]; // checklist items already on the task, so Claude doesn't repeat them
};

const list = (v: unknown, max = 20) => (Array.isArray(v) ? v.filter((x) => typeof x === 'string' && x.trim()).slice(0, max).map((x) => x.trim()) : []);

/** Volatile part of the prompt, rendered on the user turn. */
export function userTurn(req: BreakdownRequest): string {
  return [
    `<locale>${req.locale === 'th' ? 'th' : 'en'}</locale>`,
    `<title>${req.title.trim().slice(0, 200)}</title>`,
    req.notes?.trim() ? `<notes>${req.notes.trim().slice(0, 1000)}</notes>` : '',
    `<existing>${list(req.existing).join(', ')}</existing>`,
  ]
    .filter(Boolean)
    .join('\n');
}
