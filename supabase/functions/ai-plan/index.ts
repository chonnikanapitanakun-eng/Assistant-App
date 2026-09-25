// ai-plan — Deno Edge Function (Supabase). Phase 3 (P3-02).
// Input : PlanRequest  (_shared/plan-contract.ts) — { locale, date, weekday, now, workStart, workEnd, backlog[], busy[], energyPattern }
// Output: PlanResponse (_shared/plan-contract.ts) — { schedule[], skipped[], summary }
//
// Claude fills PLAN_SCHEMA through structured output; normalizePlanResponse then drops anything that is not
// a valid, non-overlapping block for a known task. The app shows the result as one proposal card the user
// approves (or trims) before any task is moved — this function never touches user data.
// A 5xx or an empty `schedule` both mean "use the local planner" on the app side.
//
// Deploy:  supabase secrets set ANTHROPIC_API_KEY=...   &&   supabase functions deploy ai-plan
import Anthropic from 'npm:@anthropic-ai/sdk';

import { PLAN_SCHEMA, normalizePlanRequest, normalizePlanResponse, type PlanResponse } from '../_shared/plan-contract.ts';
import { logUsage, userIdFrom } from '../_shared/usage.ts';
import { SYSTEM, userTurn } from './prompt.ts';

const MODEL = 'claude-opus-5';
const client = new Anthropic(); // reads ANTHROPIC_API_KEY from the function's secrets

const CORS = { 'access-control-allow-origin': '*', 'access-control-allow-headers': 'authorization, apikey, content-type, x-device-id' };
const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json', ...CORS } });
const EMPTY: PlanResponse = { schedule: [], skipped: [], summary: '' };

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: CORS });
  if (req.method !== 'POST') return json({ error: 'method_not_allowed' }, 405);

  const plan = normalizePlanRequest(await req.json().catch(() => null));
  if (!plan) return json({ error: 'date (YYYY-MM-DD) required' }, 400);
  if (!plan.backlog.length) return json(EMPTY); // nothing to place — no need to spend tokens

  const userId = userIdFrom(req);
  const deviceId = req.headers.get('x-device-id');
  const started = Date.now();

  let result: PlanResponse = EMPTY;
  let status: 'ok' | 'refusal' | 'invalid' | 'error' = 'ok';
  let usage: Anthropic.Beta.BetaUsage | undefined;
  let model = MODEL;

  try {
    const response = await client.beta.messages.create({
      model: MODEL,
      max_tokens: 4096, // up to 12 small blocks + a short summary
      thinking: { type: 'adaptive' },
      output_config: { effort: 'medium', format: { type: 'json_schema', schema: PLAN_SCHEMA } }, // packing tasks into gaps needs a little reasoning
      betas: ['server-side-fallback-2026-07-01'],
      fallbacks: 'default',
      system: [{ type: 'text', text: SYSTEM, cache_control: { type: 'ephemeral' } }],
      messages: [{ role: 'user', content: userTurn(plan) }],
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
        result = normalizePlanResponse(JSON.parse(raw), plan);
      } catch {
        status = 'invalid';
      }
    }
  } catch (err) {
    status = 'error';
    void logUsage({ function_name: 'ai-plan', model, user_id: userId, device_id: deviceId, latency_ms: Date.now() - started, status });
    if (err instanceof Anthropic.RateLimitError) return json({ error: 'rate_limited' }, 429);
    if (err instanceof Anthropic.APIError) return json({ error: 'upstream', status: err.status }, 502);
    return json({ error: 'failed' }, 500);
  }

  void logUsage({
    function_name: 'ai-plan',
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

  // A refusal or unparseable output is not an error for the app: an empty schedule → it plans locally.
  return json(result);
});
