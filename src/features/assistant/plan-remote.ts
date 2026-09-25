import { planDay } from '@/features/ai/plan';

import { buildPlanRequest, planReply } from './plan';
import { ASSISTANT_TIMEOUT_MS } from './remote';
import type { AssistantContext, Reply, T } from './types';

/** "Plan my day" with Claude when configured; `planDay` falls back to the local planner on any failure. */
export async function planDayWithAI(ctx: AssistantContext, t: T, locale: string): Promise<Reply> {
  const req = buildPlanRequest(ctx, locale);
  // Same cap as the chat call: a hung request aborts and planDay falls back to the local planner.
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), ASSISTANT_TIMEOUT_MS);
  try {
    const { source, ...plan } = await planDay(req, controller.signal);
    return planReply(ctx, req, plan, t, source);
  } finally {
    clearTimeout(timer);
  }
}
