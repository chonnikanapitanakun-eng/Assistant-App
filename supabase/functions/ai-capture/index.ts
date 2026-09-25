// ai-capture — Deno Edge Function (Supabase). Phase 1.
// Input : CaptureRequest (prompt.ts) — { text, locale, today, weekday, defaultCurrency, contacts[], areas[], wallets[], categories }
// Output: CaptureResponse (src/features/ai/types.ts) — { items: CaptureItem[], confidence }
//
// Claude fills CAPTURE_SCHEMA through structured output; the result is normalised before it leaves,
// so the app can trust the shape. The app keeps its rule-based parser as the offline / error fallback
// (a 5xx or `{ items: [] }` both mean "use the local result").
//
// Deploy:  supabase secrets set ANTHROPIC_API_KEY=...   &&   supabase functions deploy ai-capture
import Anthropic from 'npm:@anthropic-ai/sdk';

import { CAPTURE_SCHEMA, normalizeCaptureResponse, type CaptureResponse } from '../_shared/capture-contract.ts';
import { checkQuota } from '../_shared/quota.ts';
import { logUsage, userIdFrom } from '../_shared/usage.ts';
import { SYSTEM, userTurn, type CaptureRequest } from './prompt.ts';

const MODEL = 'claude-opus-5';
const client = new Anthropic(); // reads ANTHROPIC_API_KEY from the function's secrets

const CORS = { 'access-control-allow-origin': '*', 'access-control-allow-headers': 'authorization, apikey, content-type, x-device-id' };
const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json', ...CORS } });
const EMPTY: CaptureResponse = { items: [], confidence: 0 };

const WEEKDAYS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
const isDate = (v: unknown): v is string => typeof v === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(v);

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: CORS });
  if (req.method !== 'POST') return json({ error: 'method_not_allowed' }, 405);

  const body = (await req.json().catch(() => null)) as CaptureRequest | null;
  const text = typeof body?.text === 'string' ? body.text.trim() : '';
  if (!text) return json({ error: 'text required' }, 400);
  if (text.length > 2000) return json({ error: 'text too long (max 2000 chars)' }, 413);

  // The app sends its local date; we only fall back to the server clock when it is missing.
  const today = isDate(body!.today) ? body!.today : new Date().toISOString().slice(0, 10);
  const weekday = WEEKDAYS.includes(body!.weekday ?? '') ? body!.weekday! : WEEKDAYS[new Date(`${today}T12:00:00Z`).getUTCDay()];
  const userId = userIdFrom(req);
  const deviceId = req.headers.get('x-device-id');

  // Pro only (P4-06): 402 / 429 tell the app to keep its local parse and show the upgrade / cap note.
  const quota = await checkQuota(userId);
  if (!quota.ok) return json(quota.body, quota.status);
  const started = Date.now();

  let result: CaptureResponse = EMPTY;
  let status: 'ok' | 'refusal' | 'invalid' | 'error' = 'ok';
  let usage: Anthropic.Beta.BetaUsage | undefined;
  let model = MODEL;

  try {
    const response = await client.beta.messages.create({
      model: MODEL,
      max_tokens: 2048, // a handful of small JSON items; well under the 16k default on purpose
      thinking: { type: 'adaptive' },
      output_config: { effort: 'low', format: { type: 'json_schema', schema: CAPTURE_SCHEMA } }, // extraction: fast and cheap
      betas: ['server-side-fallback-2026-07-01'],
      fallbacks: 'default',
      system: [{ type: 'text', text: SYSTEM, cache_control: { type: 'ephemeral' } }],
      messages: [{ role: 'user', content: userTurn(body!, today, weekday) }],
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
        result = normalizeCaptureResponse(JSON.parse(raw), { defaultCurrency: body!.defaultCurrency, today });
      } catch {
        status = 'invalid';
      }
    }
  } catch (err) {
    status = 'error';
    void logUsage({ function_name: 'ai-capture', model, user_id: userId, device_id: deviceId, latency_ms: Date.now() - started, status });
    if (err instanceof Anthropic.RateLimitError) return json({ error: 'rate_limited' }, 429);
    if (err instanceof Anthropic.APIError) return json({ error: 'upstream', status: err.status }, 502);
    return json({ error: 'failed' }, 500);
  }

  void logUsage({
    function_name: 'ai-capture',
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

  // A refusal or unparseable output is not an error for the app: empty items → it keeps its local parse.
  return json(result);
});
