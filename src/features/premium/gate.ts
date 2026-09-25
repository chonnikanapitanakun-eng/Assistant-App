import { getSession, useSession } from '@/features/auth';

import { getPro, noteAiCall, noteBlocked, usePremiumStore } from './store';

/**
 * Thrown by the AI remote.ts files when a function refuses with 402 (not Pro / signed out) or
 * 429 `quota_exceeded` (monthly fair-use cap). Callers treat it like offline: local result stays.
 */
export class PremiumGateError extends Error {
  constructor(readonly kind: 'premium_required' | 'quota_exceeded') {
    super(kind);
  }
}

/**
 * AI features run only for a signed-in Pro user under the cap — skip the round trip otherwise.
 * A refusal sticks until the next status refresh (app foreground / purchase), so a stale local
 * "Pro" can't hammer the gate on every keystroke.
 */
export const aiAllowed = () => !!getSession() && getPro() && !usePremiumStore.getState().blocked;

/** Reactive aiAllowed() for screens. */
export function useAiAllowed() {
  const signedIn = !!useSession();
  const open = usePremiumStore((s) => (s.storePro || s.serverPro) && !s.blocked);
  return signedIn && open;
}

/**
 * Shared response check for ai-capture / assistant / slip-ocr. Returns normally for a 2xx,
 * records the refusal and throws PremiumGateError for 402 / quota 429, throws Error otherwise.
 */
export async function checkAiResponse(res: Response, name: string): Promise<void> {
  if (res.ok) {
    noteAiCall();
    return;
  }
  if (res.status === 402 || res.status === 429) {
    const body = (await res.json().catch(() => null)) as { error?: string; used?: number; limit?: number } | null;
    if (body?.error === 'premium_required' || body?.error === 'quota_exceeded') {
      noteBlocked(body.error, { used: body.used, limit: body.limit });
      throw new PremiumGateError(body.error);
    }
  }
  throw new Error(`${name} ${res.status}`);
}
