// ai-summary — Deno Edge Function (Supabase). Phase 2.
// Input : SummaryRequest  (_shared/summary-contract.ts) — { scope: day|week, from, to, locale, tasks[], events[], bills[], money, checkins[] }
// Output: SummaryResponse (src/features/ai/summary.ts)  — { headline, summary, highlights[], needsAttention[] }
//
// Claude fills SUMMARY_SCHEMA through structured output; the result is normalised before it leaves.
// The app keeps a rule-based summary as the offline / error fallback (a 5xx or `null` both mean "use it").
//
// Deploy:  supabase secrets set ANTHROPIC_API_KEY=...   &&   supabase functions deploy ai-summary
import Anthropic from 'npm:@anthropic-ai/sdk';

import { boundSummaryRequest, normalizeSummaryResponse, SUMMARY_SCHEMA, type SummaryRequest, type SummaryResponse } from '../_shared/summary-contract.ts';
import { logUsage, userIdFrom } from '../_shared/usage.ts';
import { SYSTEM, userTurn } from './prompt.ts';

const MODEL = 'claude-opus-5';
const client = new Anthropic(); // reads ANTHROPIC_API_KEY from the function's secrets

const CORS = { 'access-control-allow-origin': '*', 'access-control-allow-headers': 'authorization, apikey, content-type, x-device-id' };
const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json', ...CORS } });

const WEEKDAYS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
const isDate = (v: unknown): v is string => typeof v === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(v);

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: CORS });
  if (req.method !== 'POST') return json({ error: 'method_not_allowed' }, 405);

  const raw = (await req.json().catch(() => null)) as Partial<SummaryRequest> | null;
  if (!raw || (raw.scope !== 'day' && raw.scope !== 'week')) return json({ error: 'scope must be day or week' }, 400);
  if (!isDate(raw.from) || !isDate(raw.to) || raw.from > raw.to) return json({ error: 'from/to must be YYYY-MM-DD, from <= to' }, 400);
  const body = boundSummaryRequest(raw as SummaryRequest);

  // The app sends its local date; we only fall back to the server clock when it is missing.
  const today = isDate(body.today) ? body.today : new Date().toISOString().slice(0, 10);
  const weekday = WEEKDAYS.includes(body.weekday ?? '') ? body.weekday! : WEEKDAYS[new Date(`${today}T12:00:00Z`).getUTCDay()];
  const userId = userIdFrom(req);
  const deviceId = req.headers.get('x-device-id');
  const started = Date.now();

  let result: SummaryResponse | null = null;
  let status: 'ok' | 'refusal' | 'invalid' | 'error' = 'ok';
  let usage: Anthropic.Beta.BetaUsage | undefined;
  let model = MODEL;

  try {
    const response = await client.beta.messages.create({
      model: MODEL,
      max_tokens: 2048, // a few sentences and two short lists
      thinking: { type: 'adaptive' },
      output_config: { effort: 'low', format: { type: 'json_schema', schema: SUMMARY_SCHEMA } }, // summarising given rows: fast and cheap
      betas: ['server-side-fallback-2026-07-01'],
      fallbacks: 'default',
      system: [{ type: 'text', text: SYSTEM, cache_control: { type: 'ephemeral' } }],
      messages: [{ role: 'user', content: userTurn(body, today, weekday) }],
    });
    usage = response.usage;
    model = response.model;

    if (response.stop_reason === 'refusal') {
      status = 'refusal';
    } else if (response.stop_reason === 'max_tokens') {
      status = 'invalid';
    } else {
      const text = response.content.filter((b): b is Anthropic.Beta.BetaTextBlock => b.type === 'text').map((b) => b.text).join('');
      try {
        result = normalizeSummaryResponse(JSON.parse(text));
        if (!result) status = 'invalid';
      } catch {
        status = 'invalid';
      }
    }
  } catch (err) {
    status = 'error';
    void logUsage({ function_name: 'ai-summary', model, user_id: userId, device_id: deviceId, latency_ms: Date.now() - started, status });
    if (err instanceof Anthropic.RateLimitError) return json({ error: 'rate_limited' }, 429);
    if (err instanceof Anthropic.APIError) return json({ error: 'upstream', status: err.status }, 502);
    return json({ error: 'failed' }, 500);
  }

  void logUsage({
    function_name: 'ai-summary',
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

  // A refusal or unparseable output is not an error for the app: `summary: null` → it shows its local summary.
  return json({ summary: result, status });
});
