import type { BatchItem } from 'drizzle-orm/batch';

import { db, notes, tasks, transactions, wallets } from '@/db';
import { syncTaskReminder } from '@/features/notifications';
import { newId, now } from '@/lib/ids';
import { combineDateTime, toDateKey } from '@/lib/date';

import type { CaptureItem } from './types';

/** บันทึก CaptureItem[] ที่ user ยืนยันแล้วลง DB — task ที่มีวัน+เวลาจะตั้ง reminder ให้อัตโนมัติ */
export async function saveCaptureItems(items: CaptureItem[]) {
  const t = now();
  const base = { id: newId(), createdAt: t, updatedAt: t };
  const defaultWallet = await db.select().from(wallets).orderBy(wallets.sortOrder).limit(1).get();
  const newTaskReminders: { id: string; title: string; reminderAt: number }[] = [];
  const inserts: BatchItem<'sqlite'>[] = [];

  for (const item of items) {
    switch (item.type) {
      case 'task': {
        const id = newId();
        const reminderAt = combineDateTime(item.date, item.startTime);
        inserts.push(db.insert(tasks).values({ ...base, id, title: item.title, date: item.date, startTime: item.startTime, endTime: item.endTime, reminderAt }));
        if (reminderAt) newTaskReminders.push({ id, title: item.title, reminderAt });
        break;
      }
      case 'expense':
      case 'income':
        if (!defaultWallet) break;
        inserts.push(db.insert(transactions).values({
          ...base,
          id: newId(),
          walletId: defaultWallet.id,
          amount: item.amount,
          currency: item.currency,
          type: item.type,
          note: item.note,
          date: item.date ?? toDateKey(),
          source: 'ai',
        }));
        break;
      case 'note':
        inserts.push(db.insert(notes).values({ ...base, id: newId(), title: item.body.split('\n')[0].slice(0, 60), body: item.body }));
        break;
    }
  }

  // batch = transaction เดียว: บันทึกครบทุกรายการหรือไม่บันทึกเลย (ดู src/db/client.ts)
  const [first, ...rest] = inserts;
  if (first) await db.batch([first, ...rest]);

  for (const task of newTaskReminders) {
    void syncTaskReminder({ ...task, reminderNotificationId: null });
  }
}
