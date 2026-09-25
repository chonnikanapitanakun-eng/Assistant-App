// Best-effort token log into `ai_usage` (supabase/migrations/20260924000000_ai_usage.sql).
// Uses the service-role key that Supabase injects into every Edge Function; never blocks the response.
import { createClient } from 'npm:@supabase/supabase-js@2';

export type UsageRow = {
  function_name: string;
  model: string;
  user_id?: string | null;
  device_id?: string | null;
  input_tokens?: number;
  output_tokens?: number;
  cache_read_tokens?: number;
  cache_creation_tokens?: number;
  latency_ms?: number;
  status?: 'ok' | 'refusal' | 'invalid' | 'error';
};

const url = Deno.env.get('SUPABASE_URL');
const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
const admin = url && serviceKey ? createClient(url, serviceKey, { auth: { persistSession: false } }) : null;

export async function logUsage(row: UsageRow): Promise<void> {
  if (!admin) return;
  try {
    const { error } = await admin.from('ai_usage').insert({ status: 'ok', ...row });
    if (error) console.warn('ai_usage insert failed', error.message);
  } catch (err) {
    console.warn('ai_usage insert threw', err);
  }
}

/** Sub of the caller's JWT when Supabase Auth is on (Phase 2); null for anon-key calls. */
export function userIdFrom(req: Request): string | null {
  const auth = req.headers.get('authorization') ?? '';
  const token = auth.replace(/^Bearer\s+/i, '');
  const parts = token.split('.');
  if (parts.length !== 3) return null;
  try {
    const payload = JSON.parse(atob(parts[1].replace(/-/g, '+').replace(/_/g, '/')));
    return payload.role === 'authenticated' && typeof payload.sub === 'string' ? payload.sub : null;
  } catch {
    return null;
  }
}
