// ai-ask — Deno Edge Function (Supabase). Phase 3 (P3-01).
// Input : AskRequest (_shared/ask-contract.ts) — { question, locale, today, weekday, currency, name, facts[], records[], coverage[] }
// Output: AskResponse — { answer, sources: [{ ref }], suggestedActions[], followUps[] }
//
// Retrieval happens in the app (src/features/ai/ask/retrieve.ts): FTS hits for the question's keywords,
// records in its time window, linked records and locally computed totals — never the whole database
// (SPEC §6.4). This function only asks Claude to answer from what it was sent and cites refs the app can
// resolve back to real rows. Refs that were not in the request are dropped before the reply leaves.
//
// Deploy:  supabase secrets set ANTHROPIC_API_KEY=...   &&   supabase functions deploy ai-ask
import Anthropic from 'npm:@anthropic-ai/sdk';

import { ASK_SCHEMA, normalizeAskResponse, type AskRequest, type AskResponse } from '../_shared/ask-contract.ts';
import { logUsage, userIdFrom } from '../_shared/usage.ts';
import { cleanRecords, SYSTEM, userTurn } from './prompt.ts';

const MODEL = 'claude-opus-5';
const client = new Anthropic(); // reads ANTHROPIC_API_KEY from the function's secrets

const CORS = { 'access-control-allow-origin': '*', 'access-control-allow-headers': 'authorization, apikey, content-type, x-device-id' };
const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json', ...CORS } });
const EMPTY: AskResponse = { answer: '', sources: [], suggestedActions: [], followUps: [] };

const WEEKDAYS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
const isDate = (v: unknown): v is string => typeof v === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(v);

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: CORS });
  if (req.method !== 'POST') return json({ error: 'method_not_allowed' }, 405);

  const body = (await req.json().catch(() => null)) as AskRequest | null;
  const question = typeof body?.question === 'string' ? body.question.trim() : '';
  if (!question) return json({ error: 'question required' }, 400);
  if (question.length > 1000) return json({ error: 'question too long (max 1000 chars)' }, 413);

  const records = cleanRecords(body!.records);
  // The app already trims context to ~8k characters; this is the hard stop against an abusive caller.
  if (records.reduce((n, r) => n + r.text.length, 0) > 20_000) return json({ error: 'context too large' }, 413);

  // The app sends its local date; we only fall back to the server clock when it is missing.
  const today = isDate(body!.today) ? body!.today : new Date().toISOString().slice(0, 10);
  const weekday = WEEKDAYS.includes(body!.weekday ?? '') ? body!.weekday! : WEEKDAYS[new Date(`${today}T12:00:00Z`).getUTCDay()];
  const userId = userIdFrom(req);
  const deviceId = req.headers.get('x-device-id');
  const started = Date.now();

  let result: AskResponse = EMPTY;
  let status: 'ok' | 'refusal' | 'invalid' | 'error' = 'ok';
  let usage: Anthropic.Beta.BetaUsage | undefined;
  let model = MODEL;

  try {
    const response = await client.beta.messages.create({
      model: MODEL,
      max_tokens: 4096, // a short answer plus a few refs; the context is what costs, not the output
      thinking: { type: 'adaptive' },
      // Q&A over retrieved records needs a little reasoning (sums across lines, overdue vs upcoming) — more than capture, less than chat.
      output_config: { effort: 'medium', format: { type: 'json_schema', schema: ASK_SCHEMA } },
      betas: ['server-side-fallback-2026-07-01'],
      fallbacks: 'default',
      system: [{ type: 'text', text: SYSTEM, cache_control: { type: 'ephemeral' } }],
      messages: [{ role: 'user', content: userTurn(body!, today, weekday, records) }],
    });
    usage = response.usage;
    model = response.model;

    if (response.stop_reason === 'refusal') {
      status = 'refusal';
    } else if (response.stop_reason === 'max_tokens') {
      status = 'invalid';
    } else {
      const raw = response.content.filter((b): b is Anthropic.Beta.BetaTextBlock => b.type === 'text').map((b) => b.text).join('');
      try {
        result = normalizeAskResponse(JSON.parse(raw), records.map((r) => r.ref));
        if (!result.answer) status = 'invalid';
      } catch {
        status = 'invalid';
      }
    }
  } catch (err) {
    status = 'error';
    void logUsage({ function_name: 'ai-ask', model, user_id: userId, device_id: deviceId, latency_ms: Date.now() - started, status });
    if (err instanceof Anthropic.RateLimitError) return json({ error: 'rate_limited' }, 429);
    if (err instanceof Anthropic.APIError) return json({ error: 'upstream', status: err.status }, 502);
    return json({ error: 'failed' }, 500);
  }

  void logUsage({
    function_name: 'ai-ask',
    model,
    user_id: userId,
    device_id: deviceId,
    input_tokens: usage?.input_tokens ?? 0,
    output_tokens: usage?.output_tokens ?? 0,
    cache_read_tokens: usage?.cache_read_input_tokens ?? 0,
    cache_creation_tokens: usage?.cache_creation_input_tokens ?? 0,
    latency_ms: Date.now() - started,
    status,
  });

  // A refusal or unparseable output comes back as an empty answer with `status`, so the app can show its own message.
  return json(status === 'ok' ? result : { ...EMPTY, status });
});
