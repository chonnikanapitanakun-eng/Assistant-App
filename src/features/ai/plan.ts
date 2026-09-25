/**
 * ai-plan (SPEC §6.4, P3-02) — client + local fallback.
 * Contract, validation และ planner ในเครื่องอยู่ที่ supabase/functions/_shared/plan-contract.ts (pure TS)
 * และถูก re-export จากที่นี่ เพื่อให้ app กับ Edge Function ใช้กติกาเดียวกันเสมอ
 */
import { getSession } from '@/features/auth';

import { normalizePlanResponse, planLocally, type PlanRequest, type PlanResponse } from '../../../supabase/functions/_shared/plan-contract';

export type { PlanBusy, PlanRequest, PlanResponse, PlanSkipped, PlanSlot, PlanTask } from '../../../supabase/functions/_shared/plan-contract';
export { planLocally, planWindow } from '../../../supabase/functions/_shared/plan-contract';

const url = process.env.EXPO_PUBLIC_SUPABASE_URL;
const anonKey = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY;

/** Claude planning runs only when the Supabase project is configured (see supabase/functions/ai-plan). */
export const planRemoteEnabled = !!url && !!anonKey;

/**
 * Ask the `ai-plan` Edge Function to lay the backlog into the day. Throws on network / HTTP errors and
 * resolves to an empty schedule when Claude placed nothing, so the caller can fall back to `planLocally`.
 * The response is re-validated here against the request (the app's last line of defence).
 */
export async function planRemote(req: PlanRequest, signal?: AbortSignal): Promise<PlanResponse> {
  const res = await fetch(`${url}/functions/v1/ai-plan`, {
    method: 'POST',
    // Signed in: the user's JWT, so ai_usage logs the real user_id (supabase/functions/_shared/usage.ts).
    headers: { 'content-type': 'application/json', authorization: `Bearer ${getSession()?.access_token ?? anonKey}`, apikey: anonKey! },
    signal,
    body: JSON.stringify(req),
  });
  if (!res.ok) throw new Error(`ai-plan ${res.status}`);
  return normalizePlanResponse(await res.json(), req);
}

/** Plan with Claude when configured, otherwise (or on any failure / empty answer) with the local planner. */
export async function planDay(req: PlanRequest): Promise<PlanResponse & { source: 'local' | 'claude' }> {
  if (planRemoteEnabled) {
    try {
      const remote = await planRemote(req);
      if (remote.schedule.length) return { ...remote, source: 'claude' };
    } catch (e) {
      console.warn('ai-plan unavailable, planning locally:', e);
    }
  }
  return { ...planLocally(req), source: 'local' };
}
