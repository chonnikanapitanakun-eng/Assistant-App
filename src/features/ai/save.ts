import { isNull } from 'drizzle-orm';

import { calendarEvents, db, notes, tasks, transactions, wallets, type LinkableType } from '@/db';
import { findOrCreateContact, linkContact } from '@/features/contacts/links';
import { syncTaskReminder } from '@/features/notifications';
import { combineDateTime, toDateKey } from '@/lib/date';
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
  const newTaskReminders: { id: string; title: string; reminderAt: number }[] = [];
  const walletList = db.select().from(wallets).where(isNull(wallets.deletedAt)).orderBy(wallets.sortOrder).all();
  // Prefer an account in the item's currency so £ amounts don't land in a THB wallet.
  const walletFor = (currency: string) => walletList.find((w) => w.currency === currency) ?? walletList[0];
  let written = 0;

  db.transaction((tx) => {
    const contactIds = new Map<string, string>();
    const contactId = (name: string) => {
      const key = name.toLowerCase();
      const id = contactIds.get(key) ?? findOrCreateContact(tx, name);
      contactIds.set(key, id);
      return id;
    };
    const link = (fromType: LinkableType, fromId: string, name?: string) => {
      if (name) linkContact(tx, fromType, fromId, contactId(name));
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
        case 'task': {
          const reminderAt = combineDateTime(item.date, item.startTime);
          tx.insert(tasks).values({ ...stamp, id, title: item.title, date: item.date, startTime: item.startTime, endTime: item.endTime, reminderAt }).run();
          if (reminderAt) newTaskReminders.push({ id, title: item.title, reminderAt });
          link('task', id, item.contactName);
          break;
        }
        case 'expense':
        case 'income':
          const wallet = walletFor(item.currency);
          if (!wallet) continue;
          tx.insert(transactions).values({
            ...stamp,
            id,
            walletId: wallet.id,
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

  // Timed tasks get a reminder automatically (scheduled after the write commits).
  for (const task of newTaskReminders) void syncTaskReminder({ ...task, reminderNotificationId: null });
  return written;
}
