// ai-breakdown — Deno Edge Function (Supabase). Phase 3.
// Input : BreakdownRequest (prompt.ts) — { title, notes, locale, existing[] }
// Output: BreakdownResponse (src/features/ai/types.ts) — { subtasks: [{ text }] }
//
// Claude fills BREAKDOWN_SCHEMA through structured output; the result is normalised before it leaves,
// so the app can trust the shape. A refusal or unparseable output just means "nothing to suggest"
// (empty subtasks) — the app shows the checklist as-is either way.
//
// Deploy:  supabase secrets set ANTHROPIC_API_KEY=...   &&   supabase functions deploy ai-breakdown
import Anthropic from 'npm:@anthropic-ai/sdk';

import { BREAKDOWN_SCHEMA, normalizeBreakdownResponse, type BreakdownResponse } from '../_shared/breakdown-contract.ts';
import { logUsage, userIdFrom } from '../_shared/usage.ts';
import { SYSTEM, userTurn, type BreakdownRequest } from './prompt.ts';

const MODEL = 'claude-opus-5';
const client = new Anthropic(); // reads ANTHROPIC_API_KEY from the function's secrets

const CORS = { 'access-control-allow-origin': '*', 'access-control-allow-headers': 'authorization, apikey, content-type, x-device-id' };
const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json', ...CORS } });
const EMPTY: BreakdownResponse = { subtasks: [] };

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: CORS });
  if (req.method !== 'POST') return json({ error: 'method_not_allowed' }, 405);

  const body = (await req.json().catch(() => null)) as BreakdownRequest | null;
  const title = typeof body?.title === 'string' ? body.title.trim() : '';
  if (!title) return json({ error: 'title required' }, 400);
  if (title.length > 200) return json({ error: 'title too long (max 200 chars)' }, 413);

  const userId = userIdFrom(req);
  const deviceId = req.headers.get('x-device-id');
  const started = Date.now();

  let result: BreakdownResponse = EMPTY;
  let status: 'ok' | 'refusal' | 'invalid' | 'error' = 'ok';
  let usage: Anthropic.Beta.BetaUsage | undefined;
  let model = MODEL;

  try {
    const response = await client.beta.messages.create({
      model: MODEL,
      max_tokens: 1024, // a handful of short steps; well under the 16k default on purpose
      thinking: { type: 'adaptive' },
      output_config: { effort: 'low', format: { type: 'json_schema', schema: BREAKDOWN_SCHEMA } }, // a short checklist: fast and cheap
      betas: ['server-side-fallback-2026-07-01'],
      fallbacks: 'default',
      system: [{ type: 'text', text: SYSTEM, cache_control: { type: 'ephemeral' } }],
      messages: [{ role: 'user', content: userTurn({ ...body!, title }) }],
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
        result = normalizeBreakdownResponse(JSON.parse(raw));
      } catch {
        status = 'invalid';
      }
    }
  } catch (err) {
    status = 'error';
    void logUsage({ function_name: 'ai-breakdown', model, user_id: userId, device_id: deviceId, latency_ms: Date.now() - started, status });
    if (err instanceof Anthropic.RateLimitError) return json({ error: 'rate_limited' }, 429);
    if (err instanceof Anthropic.APIError) return json({ error: 'upstream', status: err.status }, 502);
    return json({ error: 'failed' }, 500);
  }

  void logUsage({
    function_name: 'ai-breakdown',
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

  // A refusal or unparseable output is not an error for the app: empty subtasks just means nothing to add.
  return json(result);
});
