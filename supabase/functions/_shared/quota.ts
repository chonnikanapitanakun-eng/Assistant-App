// AI gate for every Claude-calling function (P4-06): signed in + Veyra Pro + under the monthly cap.
// Reads `entitlements` (written by the `premium` function) and counts `ai_usage` rows with the
// service-role key. Call it before the Anthropic request; a refusal never reaches Claude.
import { createClient } from 'npm:@supabase/supabase-js@2';

import { decideQuota, DEFAULT_PRO_MONTHLY_AI_LIMIT, isProRow, monthStartUtc, PRO_ENTITLEMENT, type EntitlementRow, type QuotaDecision } from './entitlement.ts';

const url = Deno.env.get('SUPABASE_URL');
const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
const admin = url && serviceKey ? createClient(url, serviceKey, { auth: { persistSession: false } }) : null;
const limit = Number(Deno.env.get('PRO_MONTHLY_AI_LIMIT')) || DEFAULT_PRO_MONTHLY_AI_LIMIT;

export type QuotaStatus = { pro: boolean; used: number; limit: number; entitlement: Partial<EntitlementRow> | null };

/** Pro flag + AI calls this month (UTC) for one user. Failed calls (`status = 'error'`) don't count. */
export async function quotaStatus(userId: string): Promise<QuotaStatus> {
  // Supabase always injects the service-role key; without it (bare local `deno run`) nothing can be checked.
  if (!admin) {
    console.warn('quota: no service-role key — gate skipped');
    return { pro: true, used: 0, limit, entitlement: null };
  }
  const [ent, usage] = await Promise.all([
    admin.from('entitlements').select('entitlement, source, active, expires_at, product_id, store, period_type, will_renew').eq('user_id', userId).eq('entitlement', PRO_ENTITLEMENT).maybeSingle(),
    admin.from('ai_usage').select('id', { count: 'exact', head: true }).eq('user_id', userId).neq('status', 'error').gte('created_at', monthStartUtc()),
  ]);
  if (ent.error) console.warn('quota: entitlements read failed', ent.error.message);
  if (usage.error) console.warn('quota: ai_usage count failed', usage.error.message);
  return { pro: isProRow(ent.data), used: usage.count ?? 0, limit, entitlement: ent.data };
}

/** Signed in + Pro + under the cap, or the 402 / 429 body to send back. */
export async function checkQuota(userId: string | null): Promise<QuotaDecision> {
  if (!userId) return decideQuota({ userId, pro: false, used: 0, limit });
  const { pro, used } = await quotaStatus(userId);
  return decideQuota({ userId, pro, used, limit });
}
