// Veyra AI — Deno Edge Function (Supabase).
// Input : { locale: 'en' | 'th', messages: { role: 'user' | 'assistant', content: string }[], context: AssistantContext (JSON) }
// Output: { text: string, proposals: Proposal[], suggestions: string[] }   (see src/features/assistant/types.ts)
//
// Claude never changes data here. Its tools only *propose* actions; the app shows each
// proposal as a card and runs it after the user taps Confirm.
//
// Deploy:  supabase secrets set ANTHROPIC_API_KEY=...   &&   supabase functions deploy assistant
import Anthropic from 'npm:@anthropic-ai/sdk';

const client = new Anthropic(); // reads ANTHROPIC_API_KEY from the function's secrets

const SYSTEM = `You are Veyra, a calm, capable personal assistant inside the Veyra app.
You help one person stay on top of their day: tasks, calendar, money, bills and notes.

How to behave:
- Be brief and warm. Lead with what the person needs to know or do next. Short paragraphs or a few bullets; no headings.
- Use only the facts in the <context> block. If something isn't there, say so rather than guessing.
- You cannot change anything yourself. When an action would help, call the matching propose/complete/reschedule/pay tool —
  the app shows it as a card the person confirms. Mention in one line what you proposed; never claim it is already done.
- Use the person's currency and local times from the context. Dates are YYYY-MM-DD, times are 24-hour HH:mm.
- Reply in the language given by <locale> (en = English, th = Thai).`;

const str = { type: 'string' } as const;
const tools: Anthropic.Beta.BetaTool[] = [
  {
    name: 'propose_task',
    description: 'Propose creating a task. Use when the person wants to remember to do something.',
    input_schema: { type: 'object', properties: { title: str, date: { ...str, description: 'YYYY-MM-DD, optional' }, start_time: { ...str, description: 'HH:mm, optional' } }, required: ['title'], additionalProperties: false },
  },
  {
    name: 'propose_event',
    description: 'Propose adding a calendar event (meeting, appointment, call).',
    input_schema: {
      type: 'object',
      properties: { title: str, date: str, start_time: { ...str, description: 'HH:mm; omit for all-day' }, end_time: str, with_person: { ...str, description: 'Contact name, optional' } },
      required: ['title', 'date'],
      additionalProperties: false,
    },
  },
  {
    name: 'propose_money',
    description: 'Propose recording an expense or income.',
    input_schema: { type: 'object', properties: { type: { type: 'string', enum: ['expense', 'income'] }, amount: { type: 'number' }, currency: { type: 'string', enum: ['THB', 'GBP', 'USD', 'EUR'] }, note: str }, required: ['type', 'amount', 'currency'], additionalProperties: false },
  },
  {
    name: 'propose_note',
    description: 'Propose saving a note.',
    input_schema: { type: 'object', properties: { body: str }, required: ['body'], additionalProperties: false },
  },
  {
    name: 'complete_task',
    description: 'Propose marking an existing task (from context) as done.',
    input_schema: { type: 'object', properties: { task_id: str, title: str }, required: ['task_id', 'title'], additionalProperties: false },
  },
  {
    name: 'reschedule_task',
    description: 'Propose moving an existing task (from context) to a date and optional time slot.',
    input_schema: { type: 'object', properties: { task_id: str, title: str, date: str, start_time: str, end_time: str }, required: ['task_id', 'title', 'date'], additionalProperties: false },
  },
  {
    name: 'pay_bill',
    description: 'Propose marking a bill (from context) as paid, which records the expense.',
    input_schema: { type: 'object', properties: { bill_id: str }, required: ['bill_id'], additionalProperties: false },
  },
];

type Ctx = { bills?: { id: string; name: string; amount: number; currency: string }[]; tasks?: { id: string }[] };
const isDate = (v: unknown): v is string => typeof v === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(v);
const isTime = (v: unknown): v is string => typeof v === 'string' && /^([01]\d|2[0-3]):[0-5]\d$/.test(v);
const optTime = (v: unknown) => (isTime(v) ? v : undefined);

/** Validate a tool call and turn it into an app Proposal (or null when the input is unusable). */
function toProposal(name: string, input: Record<string, unknown>, ctx: Ctx): Record<string, unknown> | null {
  const s = (k: string) => (typeof input[k] === 'string' ? (input[k] as string).trim() : '');
  const knownTask = (id: string) => (ctx.tasks ?? []).some((t) => t.id === id);
  switch (name) {
    case 'propose_task':
      return s('title') ? { kind: 'create', items: [{ type: 'task', title: s('title'), date: isDate(input.date) ? input.date : undefined, startTime: optTime(input.start_time) }] } : null;
    case 'propose_event':
      return s('title') && isDate(input.date)
        ? { kind: 'create', items: [{ type: 'event', title: s('title'), date: input.date, startTime: optTime(input.start_time), endTime: optTime(input.end_time), contactName: s('with_person') || undefined }] }
        : null;
    case 'propose_money': {
      const amount = Number(input.amount);
      const type = input.type === 'income' ? 'income' : 'expense';
      return Number.isFinite(amount) && amount > 0 ? { kind: 'create', items: [{ type, amount, currency: s('currency') || 'THB', note: s('note') || undefined }] } : null;
    }
    case 'propose_note':
      return s('body') ? { kind: 'create', items: [{ type: 'note', body: s('body') }] } : null;
    case 'complete_task':
      return knownTask(s('task_id')) ? { kind: 'complete_task', taskId: s('task_id'), title: s('title') } : null;
    case 'reschedule_task':
      return knownTask(s('task_id')) && isDate(input.date) ? { kind: 'reschedule_task', taskId: s('task_id'), title: s('title'), date: input.date, startTime: optTime(input.start_time), endTime: optTime(input.end_time) } : null;
    case 'pay_bill': {
      const bill = (ctx.bills ?? []).find((b) => b.id === s('bill_id'));
      return bill ? { kind: 'pay_bill', billId: bill.id, name: bill.name, amount: bill.amount, currency: bill.currency } : null;
    }
  }
  return null;
}

const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json', 'access-control-allow-origin': '*' } });

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: { 'access-control-allow-origin': '*', 'access-control-allow-headers': 'authorization, apikey, content-type' } });
  const body = await req.json().catch(() => null);
  if (!body?.messages?.length) return json({ error: 'messages required' }, 400);

  const locale = body.locale === 'th' ? 'th' : 'en';
  const ctx: Ctx = body.context ?? {};
  const history = (body.messages as { role: 'user' | 'assistant'; content: string }[]).filter((m) => m.content?.trim());
  const last = history[history.length - 1];
  // Volatile context rides on the latest user turn so the system prompt stays cacheable.
  const messages: Anthropic.Beta.BetaMessageParam[] = [
    ...history.slice(0, -1).map((m) => ({ role: m.role, content: m.content })),
    { role: 'user', content: `<locale>${locale}</locale>\n<context>${JSON.stringify(body.context ?? {})}</context>\n\n${last.content}` },
  ];

  const proposals: Record<string, unknown>[] = [];
  let text = '';
  try {
    // Manual loop: tool results just say "shown to the user for confirmation" so Claude can finish its reply.
    for (let round = 0; round < 3; round++) {
      const response = await client.beta.messages.create({
        model: 'claude-opus-5',
        max_tokens: 16000,
        thinking: { type: 'adaptive' },
        output_config: { effort: 'medium' }, // chat: responsive; raise if answers need more depth
        betas: ['server-side-fallback-2026-07-01'],
        fallbacks: 'default', // re-run a safety-declined request on Anthropic's recommended fallback model
        system: [{ type: 'text', text: SYSTEM, cache_control: { type: 'ephemeral' } }],
        tools,
        messages,
      });

      if (response.stop_reason === 'refusal') {
        text = locale === 'th' ? 'ขอโทษ เรื่องนี้ช่วยไม่ได้ ลองถามเรื่องอื่นได้นะ' : "Sorry, I can't help with that one. Try asking something else.";
        break;
      }
      for (const block of response.content) if (block.type === 'text') text += (text ? '\n\n' : '') + block.text;
      const calls = response.content.filter((b): b is Anthropic.Beta.BetaToolUseBlock => b.type === 'tool_use');
      if (response.stop_reason !== 'tool_use' || !calls.length) break;

      const results = calls.map((call) => {
        const p = toProposal(call.name, (call.input ?? {}) as Record<string, unknown>, ctx);
        if (p) proposals.push(p);
        return {
          type: 'tool_result' as const,
          tool_use_id: call.id,
          content: p ? 'Shown to the user as a card; waiting for them to confirm.' : 'Invalid or unknown item — not proposed.',
          is_error: !p,
        };
      });
      messages.push({ role: 'assistant', content: response.content }, { role: 'user', content: results });
    }
  } catch (err) {
    if (err instanceof Anthropic.RateLimitError) return json({ error: 'rate_limited' }, 429);
    if (err instanceof Anthropic.APIError) return json({ error: 'upstream', status: err.status }, 502);
    return json({ error: 'failed' }, 500);
  }

  return json({ text: text.trim(), proposals, suggestions: [] });
});
