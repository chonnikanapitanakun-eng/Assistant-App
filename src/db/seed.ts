import { count } from 'drizzle-orm';

import { addDays, toDateKey } from '@/lib/date';
import { newId, now } from '@/lib/ids';

import type { Db } from './client';
import { areas, categories, tasks, wallets } from './schema';

const stamp = () => {
  const t = now();
  return { createdAt: t, updatedAt: t };
};

/** Life Areas เริ่มต้น (SPEC §4) */
export const defaultAreas = [
  { key: 'work', nameTh: 'งาน', nameEn: 'Work', color: '#1F4A85', icon: 'briefcase', children: [
    { nameTh: 'บัญชี', nameEn: 'Accounting' },
    { nameTh: 'สอบบัญชี', nameEn: 'Audit' },
    { nameTh: 'ภาษี', nameEn: 'Tax' },
    { nameTh: 'ลูกค้า', nameEn: 'Clients' },
  ] },
  { key: 'personal', nameTh: 'ส่วนตัว', nameEn: 'Personal', color: '#2E9E6B', icon: 'heart', children: [
    { nameTh: 'สุขภาพ', nameEn: 'Health' },
    { nameTh: 'เดินทาง', nameEn: 'Travel' },
    { nameTh: 'การเงิน', nameEn: 'Finance' },
    { nameTh: 'ช้อปปิ้ง', nameEn: 'Shopping' },
  ] },
  { key: 'learning', nameTh: 'เรียนรู้', nameEn: 'Learning', color: '#7B5CC7', icon: 'book', children: [
    { nameTh: 'CIMA', nameEn: 'CIMA' },
    { nameTh: 'คอร์ส', nameEn: 'Courses' },
    { nameTh: 'อ่านหนังสือ', nameEn: 'Reading' },
  ] },
  { key: 'business', nameTh: 'ธุรกิจ', nameEn: 'Business', color: '#C9A227', icon: 'rocket', children: [
    { nameTh: 'App', nameEn: 'App' },
    { nameTh: 'การตลาด', nameEn: 'Marketing' },
  ] },
];

/** หมวดรายจ่าย/รายรับภาษาไทย */
export const defaultCategories: { nameTh: string; nameEn: string; type: 'income' | 'expense'; icon: string }[] = [
  { nameTh: 'อาหาร', nameEn: 'Food', type: 'expense', icon: 'restaurant' },
  { nameTh: 'เดินทาง', nameEn: 'Transport', type: 'expense', icon: 'car' },
  { nameTh: 'ที่พัก/บ้าน', nameEn: 'Housing', type: 'expense', icon: 'home' },
  { nameTh: 'ค่าน้ำค่าไฟ', nameEn: 'Utilities', type: 'expense', icon: 'flash' },
  { nameTh: 'Subscription', nameEn: 'Subscriptions', type: 'expense', icon: 'repeat' },
  { nameTh: 'ช้อปปิ้ง', nameEn: 'Shopping', type: 'expense', icon: 'bag' },
  { nameTh: 'สุขภาพ', nameEn: 'Health', type: 'expense', icon: 'medkit' },
  { nameTh: 'การศึกษา', nameEn: 'Education', type: 'expense', icon: 'school' },
  { nameTh: 'บันเทิง', nameEn: 'Entertainment', type: 'expense', icon: 'game-controller' },
  { nameTh: 'ของขวัญ/บริจาค', nameEn: 'Gifts', type: 'expense', icon: 'gift' },
  { nameTh: 'ภาษี', nameEn: 'Tax', type: 'expense', icon: 'document' },
  { nameTh: 'อื่นๆ', nameEn: 'Other', type: 'expense', icon: 'ellipsis-horizontal' },
  { nameTh: 'เงินเดือน', nameEn: 'Salary', type: 'income', icon: 'cash' },
  { nameTh: 'ค่าบริการ', nameEn: 'Fees', type: 'income', icon: 'receipt' },
  { nameTh: 'ปันผล', nameEn: 'Dividend', type: 'income', icon: 'trending-up' },
  { nameTh: 'ดอกเบี้ย', nameEn: 'Interest', type: 'income', icon: 'stats-chart' },
  { nameTh: 'รายรับอื่น', nameEn: 'Other income', type: 'income', icon: 'add-circle' },
];

export const defaultWallets = [
  { name: 'เงินสด', type: 'cash' as const, currency: 'THB', color: '#2E9E6B' },
  { name: 'บัญชีธนาคาร (THB)', type: 'bank' as const, currency: 'THB', color: '#1F4A85' },
  { name: 'UK Bank (GBP)', type: 'bank' as const, currency: 'GBP', color: '#4F79B8' },
];

/** A few realistic tasks so a fresh install shows the Tasks screen at work. Keyed by child area nameEn. */
function sampleTasks(today: Date) {
  const day = (n: number) => toDateKey(addDays(today, n));
  const check = (text: string, done = false) => ({ id: newId(), text, done });
  return [
    { title: 'Send engagement letter', date: day(-1), priority: 1, area: 'Clients' },
    { title: 'Prepare VAT reconciliation', date: day(0), startTime: '13:00', endTime: '15:00', priority: 1, energy: 'high' as const, area: 'Tax',
      checklist: [check('Export bank feed from Xero', true), check('Match purchase invoices'), check('Review VAT control account')] },
    { title: 'Review CIMA SCS case notes', date: day(0), priority: 2, energy: 'med' as const, area: 'CIMA' },
    { title: 'Reply to client about bank feed', date: day(0), startTime: '16:00', priority: 2, area: 'Clients' },
    { title: 'Book dentist appointment', date: day(0), priority: 3, area: 'Health', isDone: true },
    { title: 'Renew UK car insurance', date: day(2), priority: 2, area: 'Finance' },
    { title: 'Draft Q4 marketing post', date: day(5), priority: 3, energy: 'low' as const, area: 'Marketing' },
    { title: 'Read “The Psychology of Money” ch. 3', priority: 3, energy: 'low' as const, area: 'Reading' },
  ];
}

export function seedIfEmpty(db: Db) {
  const [{ value: areaCount }] = db.select({ value: count() }).from(areas).all();
  if (areaCount > 0) return;

  db.transaction((tx) => {
    const areaIds = new Map<string, string>();
    let order = 0;
    for (const a of defaultAreas) {
      const parentId = newId();
      tx.insert(areas).values({ id: parentId, nameTh: a.nameTh, nameEn: a.nameEn, color: a.color, icon: a.icon, sortOrder: order++, ...stamp() }).run();
      for (const c of a.children) {
        const id = newId();
        areaIds.set(c.nameEn, id);
        tx.insert(areas).values({ id, nameTh: c.nameTh, nameEn: c.nameEn, parentId, color: a.color, sortOrder: order++, ...stamp() }).run();
      }
    }
    sampleTasks(new Date()).forEach(({ area, isDone, ...task }, i) => {
      const s = stamp();
      tx.insert(tasks).values({ id: newId(), ...task, areaId: areaIds.get(area) ?? null, isDone: !!isDone, doneAt: isDone ? s.createdAt : null, sortOrder: i, ...s }).run();
    });
    defaultCategories.forEach((c, i) => {
      tx.insert(categories).values({ id: newId(), ...c, sortOrder: i, ...stamp() }).run();
    });
    defaultWallets.forEach((w, i) => {
      tx.insert(wallets).values({ id: newId(), ...w, sortOrder: i, ...stamp() }).run();
    });
  });
}
