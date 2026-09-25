// Contract of `ai-breakdown`, shared by the Edge Function and the app (mirror of src/features/ai/types.ts).
// Pure TypeScript — no Deno globals — so vitest can test it from the app side.

export type BreakdownSubtask = { text: string };
export type BreakdownResponse = { subtasks: BreakdownSubtask[] };

const str = { type: 'string' } as const;

/**
 * JSON schema Claude must fill (structured output). Kept to a single field per item — the app turns
 * each one straight into a checklist row ({ id, text, done: false }, see src/features/tasks/queries.ts.
 */
export const BREAKDOWN_SCHEMA = {
  type: 'object',
  properties: {
    subtasks: {
      type: 'array',
      description: '3-8 short, actionable steps, in the order they should be done. Empty when the task is already one atomic step.',
      items: {
        type: 'object',
        properties: { text: { ...str, description: 'One concrete step, short enough to read on one line' } },
        required: ['text'],
        additionalProperties: false,
      },
    },
  },
  required: ['subtasks'],
  additionalProperties: false,
} as const;

const clean = (v: unknown): string => (typeof v === 'string' ? v.replace(/\s+/g, ' ').trim() : '');

/**
 * Turn Claude's raw output into the app contract: drop unusable/duplicate/too-long steps.
 * Never throws — a bad response becomes `{ subtasks: [] }` and the app just shows nothing to add.
 */
export function normalizeBreakdownResponse(raw: unknown): BreakdownResponse {
  const input = raw && typeof raw === 'object' ? (raw as Record<string, unknown>) : {};
  const list = Array.isArray(input.subtasks) ? input.subtasks : [];
  const seen = new Set<string>();
  const subtasks: BreakdownSubtask[] = [];

  for (const entry of list.slice(0, 8)) {
    if (!entry || typeof entry !== 'object') continue;
    const text = clean((entry as Record<string, unknown>).text).slice(0, 140);
    if (!text) continue;
    const key = text.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    subtasks.push({ text });
  }

  return { subtasks };
}
