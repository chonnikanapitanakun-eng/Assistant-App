import { count } from 'drizzle-orm';

import { newId, now } from '@/lib/ids';

import type { Db } from './client';
import { areas, categories, wallets } from './schema';

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

export function seedIfEmpty(db: Db) {
  const [{ value: areaCount }] = db.select({ value: count() }).from(areas).all();
  if (areaCount > 0) return;

  db.transaction((tx) => {
    let order = 0;
    for (const a of defaultAreas) {
      const parentId = newId();
      tx.insert(areas).values({ id: parentId, nameTh: a.nameTh, nameEn: a.nameEn, color: a.color, icon: a.icon, sortOrder: order++, ...stamp() }).run();
      for (const c of a.children) {
        tx.insert(areas).values({ id: newId(), nameTh: c.nameTh, nameEn: c.nameEn, parentId, color: a.color, sortOrder: order++, ...stamp() }).run();
      }
    }
    defaultCategories.forEach((c, i) => {
      tx.insert(categories).values({ id: newId(), ...c, sortOrder: i, ...stamp() }).run();
    });
    defaultWallets.forEach((w, i) => {
      tx.insert(wallets).values({ id: newId(), ...w, sortOrder: i, ...stamp() }).run();
    });
  });
}
