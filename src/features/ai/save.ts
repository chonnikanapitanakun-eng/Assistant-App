import { db, notes, tasks, transactions, wallets } from '@/db';
import { newId, now } from '@/lib/ids';
import { toDateKey } from '@/lib/date';

import type { CaptureItem } from './types';

/** บันทึก CaptureItem[] ที่ user ยืนยันแล้วลง DB */
export function saveCaptureItems(items: CaptureItem[]) {
  const t = now();
  const base = { id: newId(), createdAt: t, updatedAt: t };
  const defaultWallet = db.select().from(wallets).orderBy(wallets.sortOrder).limit(1).get();

  db.transaction((tx) => {
    for (const item of items) {
      switch (item.type) {
        case 'task':
          tx.insert(tasks).values({ ...base, id: newId(), title: item.title, date: item.date, startTime: item.startTime, endTime: item.endTime }).run();
          break;
        case 'expense':
        case 'income':
          if (!defaultWallet) break;
          tx.insert(transactions).values({
            ...base,
            id: newId(),
            walletId: defaultWallet.id,
            amount: item.amount,
            currency: item.currency,
            type: item.type,
            note: item.note,
            date: item.date ?? toDateKey(),
            source: 'ai',
          }).run();
          break;
        case 'note':
          tx.insert(notes).values({ ...base, id: newId(), title: item.body.split('\n')[0].slice(0, 60), body: item.body }).run();
          break;
      }
    }
  });
}
