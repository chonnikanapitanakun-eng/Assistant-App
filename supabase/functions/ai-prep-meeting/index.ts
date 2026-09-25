// ai-prep-meeting — Deno Edge Function (Supabase). Phase 4 (P4-05).
// Input : PrepMeetingRequest (_shared/prep-meeting-contract.ts) — the event, its contact and the records linked to it.
//         Retrieval happens on the device (features/links getRelated); nothing else of the user's data is sent.
// Output: PrepMeetingResponse — { brief, checklist[], agenda[] }
//
// Claude fills PREP_MEETING_SCHEMA through structured output; the result is normalised before it leaves,
// so the app can trust the shape. The app shows the result for the user to read and lets them turn the
// checklist into a task — nothing is written without confirmation (SPEC §6.4).
//
// Deploy:  supabase secrets set ANTHROPIC_API_KEY=...   &&   supabase functions deploy ai-prep-meeting
import Anthropic from 'npm:@anthropic-ai/sdk';

import { isEmptyPrep, normalizePrepMeeting, PREP_MEETING_SCHEMA, type PrepMeetingRequest, type PrepMeetingResponse } from '../_shared/prep-meeting-contract.ts';
import { logUsage, userIdFrom } from '../_shared/usage.ts';
import { SYSTEM, userTurn } from './prompt.ts';

const MODEL = 'claude-opus-5';
const client = new Anthropic(); // reads ANTHROPIC_API_KEY from the function's secrets

const CORS = { 'access-control-allow-origin': '*', 'access-control-allow-headers': 'authorization, apikey, content-type, x-device-id' };
const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json', ...CORS } });
const EMPTY: PrepMeetingResponse = { brief: '', checklist: [], agenda: [] };

const WEEKDAYS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
const isDate = (v: unknown): v is string => typeof v === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(v);
const MAX_BODY = 60_000; // chars of JSON — a few notes and lists; anything bigger is not a meeting brief

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: CORS });
  if (req.method !== 'POST') return json({ error: 'method_not_allowed' }, 405);

  const text = await req.text().catch(() => '');
  if (text.length > MAX_BODY) return json({ error: 'body too large' }, 413);
  let body: PrepMeetingRequest | null = null;
  try {
    body = JSON.parse(text) as PrepMeetingRequest;
  } catch {
    body = null;
  }
  const title = typeof body?.event?.title === 'string' ? body.event.title.trim() : '';
  if (!body || !title || !isDate(body.event.date)) return json({ error: 'event.title and event.date required' }, 400);

  const today = isDate(body.today) ? body.today : new Date().toISOString().slice(0, 10);
  const weekday = WEEKDAYS[new Date(`${today}T12:00:00Z`).getUTCDay()];
  const userId = userIdFrom(req);
  const deviceId = req.headers.get('x-device-id');
  const started = Date.now();

  let result: PrepMeetingResponse = EMPTY;
  let status: 'ok' | 'refusal' | 'invalid' | 'error' = 'ok';
  let usage: Anthropic.Beta.BetaUsage | undefined;
  let model = MODEL;

  try {
    const response = await client.beta.messages.create({
      model: MODEL,
      max_tokens: 4096, // a few paragraphs plus two short lists
      thinking: { type: 'adaptive' },
      output_config: { effort: 'medium', format: { type: 'json_schema', schema: PREP_MEETING_SCHEMA } }, // synthesis across records: a notch above extraction
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
      const raw = response.content.filter((b): b is Anthropic.Beta.BetaTextBlock => b.type === 'text').map((b) => b.text).join('');
      try {
        result = normalizePrepMeeting(JSON.parse(raw));
        if (isEmptyPrep(result)) status = 'invalid';
      } catch {
        status = 'invalid';
      }
    }
  } catch (err) {
    status = 'error';
    void logUsage({ function_name: 'ai-prep-meeting', model, user_id: userId, device_id: deviceId, latency_ms: Date.now() - started, status });
    if (err instanceof Anthropic.RateLimitError) return json({ error: 'rate_limited' }, 429);
    if (err instanceof Anthropic.APIError) return json({ error: 'upstream', status: err.status }, 502);
    return json({ error: 'failed' }, 500);
  }

  void logUsage({
    function_name: 'ai-prep-meeting',
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

  // A refusal or unparseable output comes back as an empty brief; the app shows "couldn't prepare" and offers a retry.
  return json(result);
});
