// Phase 1 — Deno Edge Function
// Input : { text: string; locale: 'th' | 'en'; today: string; contacts: string[]; areas: string[]; wallets: string[] }
// Output: CaptureResponse (src/features/ai/types.ts)
//
// TODO(Phase 1): เรียก Claude API ด้วย structured output (JSON schema = CaptureResponse)
// และ fallback ไป parseCaptureLocally ฝั่ง app เมื่อ offline หรือ error

Deno.serve(async (req) => {
  const body = await req.json().catch(() => null);
  if (!body?.text) {
    return new Response(JSON.stringify({ error: 'text required' }), { status: 400, headers: { 'content-type': 'application/json' } });
  }
  return new Response(JSON.stringify({ items: [], confidence: 0 }), { headers: { 'content-type': 'application/json' } });
});
