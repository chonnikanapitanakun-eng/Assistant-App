// Veyra AI — Deno Edge Function (Supabase).
// Input : { locale: 'en' | 'th', messages: { role: 'user' | 'assistant', content: string }[], context: AssistantContext (JSON) }
// Output: { text: string, proposals: Proposal[], suggestions: string[] }   (see src/features/assistant/types.ts)
// Limits: POST only; ≤ 30 messages of ≤ 4000 chars, starting and ending with `user` (empty turns are
// dropped and consecutive same-role turns merged first); context ≤ 32 KB of JSON. Violations get 400/413 with an `error` code.
// Token usage is logged to `ai_usage` (function_name 'assistant').
//
// Claude never changes data here. Its tools only *propose* actions; the app shows each
// proposal as a card and runs it after the user taps Confirm.
//
// Deploy:  supabase secrets set ANTHROPIC_API_KEY=...   &&   supabase functions deploy assistant
import Anthropic from 'npm:@anthropic-ai/sdk';

import { CURRENCIES, endAfter } from '../_shared/capture-contract.ts';
import { logUsage, userIdFrom, type UsageRow } from '../_shared/usage.ts';

const MODEL = 'claude-opus-5';
const client = new Anthropic(); // reads ANTHROPIC_API_KEY from the function's secrets

// Input limits: the app sends at most 13 turns (src/features/assistant/remote.ts) and a small context.
const MAX_MESSAGES = 30;
const MAX_CONTENT_CHARS = 4000;
const MAX_CONTEXT_BYTES = 32 * 1024;
/** Largest amount a money proposal may carry (any currency). */
const MAX_AMOUNT = 100_000_000;

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
    input_schema: { type: 'object', properties: { type: { type: 'string', enum: ['expense', 'income'] }, amount: { type: 'number' }, currency: { type: 'string', enum: [...CURRENCIES] }, note: str }, required: ['type', 'amount', 'currency'], additionalProperties: false },
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

type Ctx = { currency?: string; bills?: { id: string; name: string; amount: number; currency: string }[]; tasks?: { id: string }[] };
const isCurrency = (v: unknown): v is string => CURRENCIES.includes(v as (typeof CURRENCIES)[number]);
const isDate = (v: unknown): v is string => typeof v === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(v);
const isTime = (v: unknown): v is string => typeof v === 'string' && /^([01]\d|2[0-3]):[0-5]\d$/.test(v);
const optTime = (v: unknown) => (isTime(v) ? v : undefined);

/** Validate a tool call and turn it into an app Proposal (or null when the input is unusable). */
function toProposal(name: string, input: Record<string, unknown>, ctx: Ctx): Record<string, unknown> | null {
  const s = (k: string) => (typeof input[k] === 'string' ? (input[k] as string).trim() : '');
  const knownTask = (id: string) => (Array.isArray(ctx.tasks) ? ctx.tasks : []).some((t) => t?.id === id);
  switch (name) {
    case 'propose_task':
      return s('title') ? { kind: 'create', items: [{ type: 'task', title: s('title'), date: isDate(input.date) ? input.date : undefined, startTime: optTime(input.start_time) }] } : null;
    case 'propose_event':
      return s('title') && isDate(input.date)
        ? { kind: 'create', items: [{ type: 'event', title: s('title'), date: input.date, startTime: optTime(input.start_time), endTime: endAfter(optTime(input.start_time), optTime(input.end_time)), contactName: s('with_person') || undefined }] }
        : null;
    case 'propose_money': {
      const raw = typeof input.amount === 'number' ? input.amount : Number(input.amount);
      const amount = Math.round(raw * 100) / 100;
      if (!Number.isFinite(amount) || amount <= 0 || amount > MAX_AMOUNT) return null;
      const type = input.type === 'income' ? 'income' : 'expense';
      // Same currency set as the capture contract; otherwise the person's primary currency, else THB.
      const currency = isCurrency(s('currency')) ? s('currency') : isCurrency(ctx.currency) ? ctx.currency : 'THB';
      return { kind: 'create', items: [{ type, amount, currency, note: s('note') || undefined }] };
    }
    case 'propose_note':
      return s('body') ? { kind: 'create', items: [{ type: 'note', body: s('body') }] } : null;
    case 'complete_task':
      return knownTask(s('task_id')) ? { kind: 'complete_task', taskId: s('task_id'), title: s('title') } : null;
    case 'reschedule_task':
      return knownTask(s('task_id')) && isDate(input.date)
        ? { kind: 'reschedule_task', taskId: s('task_id'), title: s('title'), date: input.date, startTime: optTime(input.start_time), endTime: endAfter(optTime(input.start_time), optTime(input.end_time)) }
        : null;
    case 'pay_bill': {
      const bill = (Array.isArray(ctx.bills) ? ctx.bills : []).find((b) => b?.id === s('bill_id'));
      return bill ? { kind: 'pay_bill', billId: bill.id, name: bill.name, amount: bill.amount, currency: bill.currency } : null;
    }
  }
  return null;
}

const CORS = { 'access-control-allow-origin': '*', 'access-control-allow-headers': 'authorization, apikey, content-type, x-device-id' };
const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json', ...CORS } });

type Turn = { role: 'user' | 'assistant'; content: string };
type Invalid = { error: string; status: number; detail?: string };

/**
 * Check the request against the input limits. Empty turns are dropped first (as the app does);
 * what is left must start and end with a user turn and alternate user / assistant.
 */
function validate(body: unknown): { history: Turn[]; ctx: Ctx; contextJson: string } | Invalid {
  if (!body || typeof body !== 'object') return { error: 'invalid_json', status: 400 };
  const b = body as Record<string, unknown>;
  if (!Array.isArray(b.messages) || !b.messages.length) return { error: 'messages_required', status: 400 };
  if (b.messages.length > MAX_MESSAGES) return { error: 'too_many_messages', status: 413, detail: `max ${MAX_MESSAGES}` };
  const history: Turn[] = [];
  for (const m of b.messages as unknown[]) {
    const { role, content } = (m ?? {}) as Record<string, unknown>;
    if (role !== 'user' && role !== 'assistant') return { error: 'invalid_role', status: 400, detail: 'role must be "user" or "assistant"' };
    if (typeof content !== 'string') return { error: 'invalid_content', status: 400, detail: 'content must be a string' };
    if (content.length > MAX_CONTENT_CHARS) return { error: 'content_too_long', status: 413, detail: `max ${MAX_CONTENT_CHARS} chars per message` };
    if (!content.trim()) continue;
    // Consecutive same-role turns happen when a reply was only proposal cards (empty text) and the
    // app dropped it; merge them instead of rejecting so the conversation keeps working.
    const last = history[history.length - 1];
    if (last && last.role === role) last.content = `${last.content}\n\n${content}`;
    else history.push({ role, content });
  }
  if (!history.length) return { error: 'messages_required', status: 400 };
  if (history[0].role !== 'user') return { error: 'first_message_not_user', status: 400 };
  if (history[history.length - 1].role !== 'user') return { error: 'last_message_not_user', status: 400 };

  const context = b.context ?? {};
  if (typeof context !== 'object' || Array.isArray(context)) return { error: 'invalid_context', status: 400 };
  const contextJson = JSON.stringify(context);
  if (new TextEncoder().encode(contextJson).length > MAX_CONTEXT_BYTES) return { error: 'context_too_large', status: 413, detail: `max ${MAX_CONTEXT_BYTES} bytes` };
  return { history, ctx: context as Ctx, contextJson };
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: CORS });
  if (req.method !== 'POST') return json({ error: 'method_not_allowed' }, 405);
  const body = await req.json().catch(() => null);
  const checked = validate(body);
  if ('error' in checked) return json({ error: checked.error, ...(checked.detail ? { detail: checked.detail } : {}) }, checked.status);
  const { history, ctx, contextJson } = checked;

  const locale = body.locale === 'th' ? 'th' : 'en';
  const last = history[history.length - 1];
  // Volatile context rides on the latest user turn so the system prompt stays cacheable.
  const messages: Anthropic.Beta.BetaMessageParam[] = [
    ...history.slice(0, -1).map((m) => ({ role: m.role, content: m.content })),
    { role: 'user', content: `<locale>${locale}</locale>\n<context>${contextJson}</context>\n\n${last.content}` },
  ];

  // Token usage summed over the tool rounds, logged to ai_usage like ai-capture.
  const started = Date.now();
  const usage = { input_tokens: 0, output_tokens: 0, cache_read_tokens: 0, cache_creation_tokens: 0 };
  let model = MODEL;
  const log = (status: UsageRow['status']) =>
    void logUsage({ function_name: 'assistant', model, user_id: userIdFrom(req), device_id: req.headers.get('x-device-id'), ...usage, latency_ms: Date.now() - started, status });

  const proposals: Record<string, unknown>[] = [];
  let text = '';
  let status: UsageRow['status'] = 'ok';
  try {
    // Manual loop: tool results just say "shown to the user for confirmation" so Claude can finish its reply.
    for (let round = 0; round < 3; round++) {
      const response = await client.beta.messages.create({
        model: MODEL,
        max_tokens: 16000,
        thinking: { type: 'adaptive' },
        output_config: { effort: 'medium' }, // chat: responsive; raise if answers need more depth
        betas: ['server-side-fallback-2026-07-01'],
        fallbacks: 'default', // re-run a safety-declined request on Anthropic's recommended fallback model
        system: [{ type: 'text', text: SYSTEM, cache_control: { type: 'ephemeral' } }],
        tools,
        messages,
      });
      model = response.model;
      usage.input_tokens += response.usage.input_tokens ?? 0;
      usage.output_tokens += response.usage.output_tokens ?? 0;
      usage.cache_read_tokens += response.usage.cache_read_input_tokens ?? 0;
      usage.cache_creation_tokens += response.usage.cache_creation_input_tokens ?? 0;

      if (response.stop_reason === 'refusal') {
        status = 'refusal';
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
    log('error');
    if (err instanceof Anthropic.RateLimitError) return json({ error: 'rate_limited' }, 429);
    if (err instanceof Anthropic.APIError) return json({ error: 'upstream', status: err.status }, 502);
    return json({ error: 'failed' }, 500);
  }

  log(status);
  return json({ text: text.trim(), proposals, suggestions: [] });
});
