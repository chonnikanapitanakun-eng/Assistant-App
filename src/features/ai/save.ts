import { and, isNull, sql } from 'drizzle-orm';

import { calendarEvents, contacts, db, links, notes, tasks, transactions, wallets, type LinkableType } from '@/db';
import { toDateKey } from '@/lib/date';
import { newId, now } from '@/lib/ids';

import type { CaptureItem } from './types';

const HOUR = 60 * 60 * 1000;

/** Local epoch ms for a YYYY-MM-DD + optional HH:mm. */
function toEpoch(date: string, time?: string): number {
  const [y, m, d] = date.split('-').map(Number);
  const [h, min] = (time ?? '00:00').split(':').map(Number);
  return new Date(y, m - 1, d, h, min).getTime();
}

/**
 * Save the items the user confirmed. Contacts are de-duplicated by name and
 * linked to the event / task / transaction that mentioned them.
 * Returns how many of the confirmed items were saved (matches the Save button count).
 */
export function saveCaptureItems(items: CaptureItem[]): number {
  const t = now();
  const stamp = { createdAt: t, updatedAt: t };
  const defaultWallet = db.select().from(wallets).where(isNull(wallets.deletedAt)).orderBy(wallets.sortOrder).limit(1).get();
  let written = 0;

  db.transaction((tx) => {
    const contactIds = new Map<string, string>();
    const contactId = (name: string) => {
      const key = name.toLowerCase();
      const cached = contactIds.get(key);
      if (cached) return cached;
      const existing = tx
        .select({ id: contacts.id })
        .from(contacts)
        .where(and(sql`lower(${contacts.name}) = ${key}`, isNull(contacts.deletedAt)))
        .get();
      const id = existing?.id ?? newId();
      if (!existing) tx.insert(contacts).values({ ...stamp, id, name }).run();
      contactIds.set(key, id);
      return id;
    };
    const link = (fromType: LinkableType, fromId: string, name?: string) => {
      if (!name) return;
      tx.insert(links).values({ ...stamp, id: newId(), fromType, fromId, toType: 'contact', toId: contactId(name), relation: 'with' }).run();
    };

    for (const item of items) {
      const id = newId();
      switch (item.type) {
        case 'event': {
          const start = toEpoch(item.date, item.startTime);
          const end = item.endTime ? toEpoch(item.date, item.endTime) : start + (item.startTime ? HOUR : 24 * HOUR);
          tx.insert(calendarEvents).values({ ...stamp, id, externalId: id, source: 'veyra', title: item.title, start, end, isAllDay: !item.startTime }).run();
          link('event', id, item.contactName);
          break;
        }
        case 'task':
          tx.insert(tasks).values({ ...stamp, id, title: item.title, date: item.date, startTime: item.startTime, endTime: item.endTime }).run();
          link('task', id, item.contactName);
          break;
        case 'expense':
        case 'income':
          if (!defaultWallet) continue;
          tx.insert(transactions).values({
            ...stamp,
            id,
            walletId: defaultWallet.id,
            amount: item.amount,
            currency: item.currency,
            type: item.type,
            note: item.note,
            date: item.date ?? toDateKey(),
            source: 'ai',
          }).run();
          link('transaction', id, item.contactName);
          break;
        case 'note':
          tx.insert(notes).values({ ...stamp, id, title: item.body.split('\n')[0].slice(0, 60), body: item.body }).run();
          break;
        case 'contact':
          contactId(item.name);
          break;
      }
      written++;
    }
  });
  return written;
}
