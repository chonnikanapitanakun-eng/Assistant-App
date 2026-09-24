import { isNull } from 'drizzle-orm';

import { calendarEvents, commit, db, links, notes, tasks, transactions, wallets, type LinkableType, type Write } from '@/db';
import { linkContact, resolveContact } from '@/features/contacts/links';
import { syncTaskReminder } from '@/features/notifications';
import { background } from '@/lib/background';
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
 * Save the items the user confirmed, atomically (one batch). Contacts are de-duplicated by name
 * and linked to the event / task / transaction that mentioned them.
 * Returns how many of the confirmed items were saved (matches the Save button count).
 */
export async function saveCaptureItems(items: CaptureItem[], opts: { sourceNoteId?: string } = {}): Promise<number> {
  const t = now();
  const stamp = { createdAt: t, updatedAt: t };
  const newTaskReminders: { id: string; title: string; reminderAt: number }[] = [];
  const walletList = await db.select().from(wallets).where(isNull(wallets.deletedAt)).orderBy(wallets.sortOrder).all();
  // Prefer an account in the item's currency so £ amounts don't land in a THB wallet.
  const walletFor = (currency: string) => walletList.find((w) => w.currency === currency) ?? walletList[0];
  const writes: Write[] = [];
  let written = 0;

  // Reads happen here, before the batch; new contacts become inserts in the same batch.
  const contactIds = new Map<string, string>();
  const contactId = async (name: string) => {
    const key = name.toLowerCase();
    let id = contactIds.get(key);
    if (!id) {
      const contact = await resolveContact(name);
      if (contact.create) writes.push(contact.create);
      id = contact.id;
      contactIds.set(key, id);
    }
    return id;
  };
  const link = async (fromType: LinkableType, fromId: string, name?: string) => {
    if (name) writes.push(linkContact(fromType, fromId, await contactId(name)));
    // Items pulled out of a note remember where they came from.
    if (opts.sourceNoteId) {
      writes.push(db.insert(links).values({ ...stamp, id: newId(), fromType: 'note', fromId: opts.sourceNoteId, toType: fromType, toId: fromId, relation: 'extracted' }));
    }
  };

  for (const item of items) {
    const id = newId();
    switch (item.type) {
      case 'event': {
        const start = toEpoch(item.date, item.startTime);
        const end = item.endTime ? toEpoch(item.date, item.endTime) : start + (item.startTime ? HOUR : 24 * HOUR);
        writes.push(db.insert(calendarEvents).values({ ...stamp, id, externalId: id, source: 'veyra', title: item.title, start, end, isAllDay: !item.startTime }));
        await link('event', id, item.contactName);
        break;
      }
      case 'task': {
        const reminderAt = combineDateTime(item.date, item.startTime);
        writes.push(db.insert(tasks).values({ ...stamp, id, title: item.title, date: item.date, startTime: item.startTime, endTime: item.endTime, reminderAt }));
        if (reminderAt) newTaskReminders.push({ id, title: item.title, reminderAt });
        await link('task', id, item.contactName);
        break;
      }
      case 'expense':
      case 'income': {
        const wallet = walletFor(item.currency);
        if (!wallet) continue;
        writes.push(
          db.insert(transactions).values({
            ...stamp,
            id,
            walletId: wallet.id,
            amount: item.amount,
            currency: item.currency,
            type: item.type,
            note: item.note,
            date: item.date ?? toDateKey(),
            source: 'ai',
          }),
        );
        await link('transaction', id, item.contactName);
        break;
      }
      case 'note':
        writes.push(db.insert(notes).values({ ...stamp, id, title: item.body.split('\n')[0].slice(0, 60), body: item.body }));
        break;
      case 'contact':
        await contactId(item.name);
        break;
    }
    written++;
  }

  await commit(writes);

  // Timed tasks get a reminder automatically (scheduled after the write commits).
  for (const task of newTaskReminders) background(syncTaskReminder({ ...task, reminderNotificationId: null }), 'Task reminder');
  return written;
}
