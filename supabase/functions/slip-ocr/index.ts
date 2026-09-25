// slip-ocr — Deno Edge Function (Supabase). Phase 3 (P3-04).
// Input : { image: base64 JPEG (the app resizes to ~800px wide first) }
// Output: SlipResult (_shared/slip-contract.ts) — { isSlip, amount, date, time, ref, from, to, memo, fee }
//
// The app only calls this after its free steps (slip QR → duplicate check) — see src/features/slip/scan.ts.
// Haiku 4.5: reading a printed slip is plain extraction, so the cheapest vision model is enough
// (~1.5k image tokens + ~0.7k prompt + ~150 output ≈ US$0.003 per slip).
//
// Deploy:  supabase functions deploy slip-ocr   (uses the same ANTHROPIC_API_KEY secret as ai-capture)
import Anthropic from 'npm:@anthropic-ai/sdk';

import { normalizeSlip, SLIP_SCHEMA, type SlipResult } from '../_shared/slip-contract.ts';
import { checkQuota } from '../_shared/quota.ts';
import { logUsage, userIdFrom } from '../_shared/usage.ts';
import { SYSTEM } from './prompt.ts';

const MODEL = 'claude-haiku-4-5';
const MAX_IMAGE_B64 = 1_500_000; // ≈1.1 MB JPEG — an 800px slip is ~100–200 KB
const client = new Anthropic(); // reads ANTHROPIC_API_KEY from the function's secrets

const CORS = { 'access-control-allow-origin': '*', 'access-control-allow-headers': 'authorization, apikey, content-type, x-device-id' };
const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json', ...CORS } });
const NOT_SLIP: SlipResult = { isSlip: false, from: {}, to: {} };

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: CORS });
  if (req.method !== 'POST') return json({ error: 'method_not_allowed' }, 405);

  const body = (await req.json().catch(() => null)) as { image?: unknown } | null;
  const image = typeof body?.image === 'string' ? body.image.replace(/^data:image\/\w+;base64,/, '') : '';
  if (!image) return json({ error: 'image required' }, 400);
  if (image.length > MAX_IMAGE_B64) return json({ error: 'image too large' }, 413);

  const userId = userIdFrom(req);
  const deviceId = req.headers.get('x-device-id');

  // Pro only (P4-06): 402 / 429 → the app lets the user fill the slip by hand.
  const quota = await checkQuota(userId);
  if (!quota.ok) return json(quota.body, quota.status);
  const started = Date.now();

  let result: SlipResult = NOT_SLIP;
  let status: 'ok' | 'refusal' | 'invalid' | 'error' = 'ok';
  let usage: Anthropic.Usage | undefined;
  let model = MODEL;

  try {
    const response = await client.messages.create({
      model: MODEL,
      max_tokens: 1024, // one small JSON object
      output_config: { format: { type: 'json_schema', schema: SLIP_SCHEMA } },
      system: SYSTEM,
      messages: [
        {
          role: 'user',
          content: [
            { type: 'image', source: { type: 'base64', media_type: 'image/jpeg', data: image } },
            { type: 'text', text: 'Read this slip.' },
          ],
        },
      ],
    });
    usage = response.usage;
    model = response.model;

    if (response.stop_reason === 'refusal') {
      status = 'refusal';
    } else if (response.stop_reason === 'max_tokens') {
      status = 'invalid';
    } else {
      const raw = response.content.filter((b): b is Anthropic.TextBlock => b.type === 'text').map((b) => b.text).join('');
      try {
        result = normalizeSlip(JSON.parse(raw));
      } catch {
        status = 'invalid';
      }
    }
  } catch (err) {
    status = 'error';
    void logUsage({ function_name: 'slip-ocr', model, user_id: userId, device_id: deviceId, latency_ms: Date.now() - started, status });
    if (err instanceof Anthropic.RateLimitError) return json({ error: 'rate_limited' }, 429);
    if (err instanceof Anthropic.BadRequestError) return json({ error: 'bad_image' }, 400);
    if (err instanceof Anthropic.APIError) return json({ error: 'upstream', status: err.status }, 502);
    return json({ error: 'failed' }, 500);
  }

  void logUsage({
    function_name: 'slip-ocr',
    model,
    user_id: userId,
    device_id: deviceId,
    input_tokens: usage?.input_tokens ?? 0,
    output_tokens: usage?.output_tokens ?? 0,
    latency_ms: Date.now() - started,
    status,
  });

  // A refusal or unparseable output reaches the app as "not a slip" — the user fills the form by hand.
  return json(result);
});
