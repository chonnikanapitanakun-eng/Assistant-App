import { asc, eq, isNull } from 'drizzle-orm';

import { assistantMessages, db, useRows, type AssistantMessage } from '@/db';
import { newId, now } from '@/lib/ids';

import type { Card } from './types';

export type ChatPayload = { cards: Card[]; suggestions: string[]; source?: 'local' | 'claude' };

/** Conversation in order (oldest first). */
export function useMessages(): AssistantMessage[] {
  return useRows(db.select().from(assistantMessages).where(isNull(assistantMessages.deletedAt)).orderBy(asc(assistantMessages.createdAt))).data;
}

export async function addMessage(role: 'user' | 'assistant', text: string, payload?: ChatPayload): Promise<string> {
  const id = newId();
  const t = now();
  await db.insert(assistantMessages).values({ id, role, text, payload: payload ?? null, createdAt: t, updatedAt: t });
  return id;
}

type ProposalCard = Extract<Card, { type: 'proposal' }>;

// Card updates are read-modify-write of one JSON payload; run them one at a time so two quick
// taps on different cards of the same message can't overwrite each other.
let cardQueue: Promise<unknown> = Promise.resolve();
function serial<T>(task: () => Promise<T>): Promise<T> {
  const result = cardQueue.then(task);
  cardQueue = result.catch(() => undefined);
  return result;
}

/** Proposals being carried out right now (`messageId:cardId`). */
const running = new Set<string>();
const runKey = (messageId: string, cardId: string) => `${messageId}:${cardId}`;

async function readPayload(messageId: string): Promise<ChatPayload | null> {
  const row = await db.select({ payload: assistantMessages.payload }).from(assistantMessages).where(eq(assistantMessages.id, messageId)).get();
  return (row?.payload as ChatPayload | null | undefined) ?? null;
}

async function writeCard(messageId: string, payload: ChatPayload, cardId: string, patch: Partial<ProposalCard>) {
  const cards = payload.cards.map((c) => (c.type === 'proposal' && c.id === cardId ? ({ ...c, ...patch } as Card) : c));
  await db.update(assistantMessages).set({ payload: { ...payload, cards }, updatedAt: now() }).where(eq(assistantMessages.id, messageId));
}

/** Update one proposal card, patching the message's current payload in the DB (never a stale in-memory copy). */
export function updateCard(messageId: string, cardId: string, patch: Partial<ProposalCard>) {
  return serial(async () => {
    const payload = await readPayload(messageId);
    if (payload) await writeCard(messageId, payload, cardId, patch);
  });
}

/**
 * Claim a proposal before running it. Resolves to the card as stored when it is still pending and
 * not already running, else null — so a double tap (or a tap on a card whose "done" hasn't
 * re-rendered yet) never runs it twice. Always follow a claim with `settleProposal`.
 */
export function claimProposal(messageId: string, cardId: string): Promise<ProposalCard | null> {
  return serial(async () => {
    if (running.has(runKey(messageId, cardId))) return null;
    const card = (await readPayload(messageId))?.cards.find((c): c is ProposalCard => c.type === 'proposal' && c.id === cardId);
    if (!card || card.state !== 'pending') return null;
    running.add(runKey(messageId, cardId));
    return card;
  });
}

/** Record how a claimed proposal went and release the claim. */
export async function settleProposal(messageId: string, cardId: string, state: 'done' | 'failed') {
  try {
    await updateCard(messageId, cardId, { state });
  } finally {
    running.delete(runKey(messageId, cardId));
  }
}

/** Replace a pending proposal's content (e.g. rows removed from a day plan); ignored once it is running or settled. */
export function editProposal(messageId: string, cardId: string, proposal: ProposalCard['proposal']) {
  return serial(async () => {
    const payload = await readPayload(messageId);
    const card = payload?.cards.find((c) => c.type === 'proposal' && c.id === cardId);
    if (!payload || running.has(runKey(messageId, cardId)) || card?.type !== 'proposal' || card.state !== 'pending') return;
    await writeCard(messageId, payload, cardId, { proposal });
  });
}

/** "Not now": only a pending card that isn't running can be dismissed. */
export function dismissProposal(messageId: string, cardId: string) {
  return serial(async () => {
    const payload = await readPayload(messageId);
    const card = payload?.cards.find((c) => c.type === 'proposal' && c.id === cardId);
    if (!payload || running.has(runKey(messageId, cardId)) || card?.type !== 'proposal' || card.state !== 'pending') return;
    await writeCard(messageId, payload, cardId, { state: 'dismissed' });
  });
}

export async function clearChat() {
  const t = now();
  await db.update(assistantMessages).set({ deletedAt: t, updatedAt: t }).where(isNull(assistantMessages.deletedAt));
}
