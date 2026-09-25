import { create } from 'zustand';

import { readJSON, writeJSON } from '@/features/profile/storage';

import { DEFAULT_PRO_MONTHLY_AI_LIMIT } from './model';

/**
 * Veyra Pro status for the signed-in user (P4-06). Two sources, either one is enough:
 *   - `storePro`: RevenueCat's CustomerInfo on this device (instant after a purchase)
 *   - `serverPro`: the `entitlements` row the AI gate reads (webhook / manual grant)
 * The server is what actually allows AI calls; a 402 from any function resets `serverPro`.
 */
export type PremiumState = {
  userId: string | null;
  storePro: boolean;
  serverPro: boolean;
  expiresAt: string | null;
  willRenew: boolean | null;
  manageUrl: string | null;
  used: number | null;
  limit: number;
  /** Last gate refusal from an AI function, so screens can explain why AI was skipped. */
  blocked: 'premium_required' | 'quota_exceeded' | null;
};

const CACHE_KEY = 'premium:status';
type Cached = Pick<PremiumState, 'userId' | 'storePro' | 'serverPro' | 'expiresAt' | 'used' | 'limit'>;

const EMPTY: PremiumState = { userId: null, storePro: false, serverPro: false, expiresAt: null, willRenew: null, manageUrl: null, used: null, limit: DEFAULT_PRO_MONTHLY_AI_LIMIT, blocked: null };

// Last known status survives restarts and offline launches; it only applies to the same user (see forUser).
const cached = readJSON<Cached>(CACHE_KEY);
export const usePremiumStore = create<PremiumState>(() => ({ ...EMPTY, ...(cached ?? {}) }));

usePremiumStore.subscribe((s) => writeJSON(CACHE_KEY, { userId: s.userId, storePro: s.storePro, serverPro: s.serverPro, expiresAt: s.expiresAt, used: s.used, limit: s.limit } satisfies Cached));

const isPro = (s: PremiumState) => s.storePro || s.serverPro;

/** Switch to a user (or none): keeps the cache when it's the same person, otherwise starts from free. */
export function forUser(userId: string | null) {
  if (usePremiumStore.getState().userId === userId) return;
  usePremiumStore.setState({ ...EMPTY, userId });
}

export const usePro = () => usePremiumStore(isPro);
export const getPro = () => isPro(usePremiumStore.getState());

/** Called by remote.ts files when a function answers 402 / 429 — see gate.ts. */
export function noteBlocked(kind: 'premium_required' | 'quota_exceeded', info?: { used?: number; limit?: number }) {
  usePremiumStore.setState({
    blocked: kind,
    ...(kind === 'premium_required' ? { serverPro: false } : {}),
    ...(info?.used !== undefined ? { used: info.used } : {}),
    ...(info?.limit !== undefined ? { limit: info.limit } : {}),
  });
}

/** One successful AI call — keeps the usage meter current without another round trip. */
export function noteAiCall() {
  usePremiumStore.setState((s) => ({ used: s.used === null ? null : s.used + 1, blocked: null }));
}
