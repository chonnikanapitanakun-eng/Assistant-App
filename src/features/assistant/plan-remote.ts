import { planDay } from '@/features/ai/plan';

import { buildPlanRequest, planReply } from './plan';
import type { AssistantContext, Reply, T } from './types';

/** "Plan my day" with Claude when configured; `planDay` falls back to the local planner on any failure. */
export async function planDayWithAI(ctx: AssistantContext, t: T, locale: string): Promise<Reply> {
  const req = buildPlanRequest(ctx, locale);
  const { source, ...plan } = await planDay(req);
  return planReply(ctx, req, plan, t, source);
}
