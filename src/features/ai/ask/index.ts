/**
 * ai-ask (P3-01) — ask a question across the user's own data.
 *
 *   askQuestion("เดือนนี้ใช้เงินไปเท่าไหร่")
 *     → retrieve()  : FTS + date-range + linked records + local totals (never the whole DB)
 *     → askRemote() : Claude answers from that context and cites refs
 *     → AskResult   : answer, sources (resolved to rows), suggested actions, follow-ups
 *
 * The UI (P3-02) shows `answer`, links each source to its record, and turns a suggested action into a
 * Quick Capture item the user confirms — nothing is saved by this module.
 */
import { useCallback } from 'react';

import { useProfile } from '@/features/profile/store';

import type { AskSuggestedAction, CaptureItem } from '../types';
import { askRemote, askRemoteEnabled, type AskResult } from './remote';
import { retrieve, type AskSettings, type Retrieval } from './retrieve';

export { askRemoteEnabled, retrieve };
export type { AskResult, AskSettings, Retrieval };
export type { AskSource } from './remote';
export { planRetrieval } from './model';
export type { RetrievalPlan, Window } from './model';

/** Full pipeline for one question. Throws on network errors (the caller shows an offline message). */
export async function askQuestion(question: string, settings: AskSettings, signal?: AbortSignal): Promise<AskResult & { retrieval: Retrieval }> {
  const retrieval = await retrieve(question, settings);
  signal?.throwIfAborted();
  const result = await askRemote(question, retrieval, settings, signal);
  return { ...result, retrieval };
}

/** `askQuestion` bound to the current profile (language, primary currency, name). */
export function useAskQuestion(): (question: string, signal?: AbortSignal) => Promise<AskResult & { retrieval: Retrieval }> {
  const locale = useProfile((p) => p.language);
  const currency = useProfile((p) => p.currency);
  const name = useProfile((p) => p.name);
  return useCallback((question: string, signal?: AbortSignal) => askQuestion(question, { locale, currency, name, now: new Date() }, signal), [locale, currency, name]);
}

/** A suggested action as a Quick Capture item, so the existing preview → confirm → save flow can take it. */
export function actionToCaptureItem(a: AskSuggestedAction): CaptureItem {
  if (a.type === 'note') return { type: 'note', body: a.title };
  if (a.type === 'event' && a.date) return { type: 'event', title: a.title, date: a.date, startTime: a.startTime };
  return { type: 'task', title: a.title, date: a.date, startTime: a.startTime };
}
