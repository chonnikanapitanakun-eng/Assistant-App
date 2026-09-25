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

/** Update one card's state (e.g. a proposal was confirmed). */
export async function updateCard(message: AssistantMessage, cardId: string, patch: Partial<Card>) {
  const payload = (message.payload as ChatPayload | null) ?? { cards: [], suggestions: [] };
  const cards = payload.cards.map((c) => (c.type === 'proposal' && c.id === cardId ? ({ ...c, ...patch } as Card) : c));
  await db.update(assistantMessages).set({ payload: { ...payload, cards }, updatedAt: now() }).where(eq(assistantMessages.id, message.id));
}

export async function clearChat() {
  const t = now();
  await db.update(assistantMessages).set({ deletedAt: t, updatedAt: t }).where(isNull(assistantMessages.deletedAt));
}
