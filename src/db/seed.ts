import { count, eq } from 'drizzle-orm';

import { addDays, toDateKey, utcDayStart } from '@/lib/date';
import { newId, now } from '@/lib/ids';

import { commit, type Db, type Write } from './client';
import { areas, calendarEvents, categories, contacts, links, notes, recurringBills, tasks, transactions, wallets } from './schema';

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

/** Sample opening balances, keyed by wallet index above. */
const sampleOpening = [3500, 85000, 4200];

/** Sample monthly budgets (THB) by category nameEn. */
const sampleBudgets: Record<string, number> = { Food: 8000, Transport: 3000, Shopping: 5000, Utilities: 3000, Entertainment: 2000, Subscriptions: 1000 };

/**
 * A realistic month of money for a fresh install. `w` = wallet index, `n` = days ago
 * (clamped to this month), `cat` = category nameEn.
 */
function sampleMoney(today: Date) {
  const y = today.getFullYear();
  const m = today.getMonth();
  const d = today.getDate();
  const dayAgo = (n: number) => toDateKey(new Date(y, m, Math.max(1, d - n)));
  type T = { w: number; type: 'income' | 'expense' | 'transfer'; amount: number; n: number; cat?: string; note: string; to?: number };
  const txs: T[] = [
    { w: 1, type: 'income', amount: 45000, n: 20, cat: 'Fees', note: 'Audit fee — Somchai Trading' },
    { w: 0, type: 'expense', amount: 180, n: 0, cat: 'Food', note: 'Lunch' },
    { w: 1, type: 'expense', amount: 1250, n: 3, cat: 'Food', note: 'Groceries — Tops' },
    { w: 0, type: 'expense', amount: 420, n: 6, cat: 'Food', note: 'Coffee & snacks' },
    { w: 1, type: 'expense', amount: 2100, n: 12, cat: 'Food', note: 'Dinner with family' },
    { w: 0, type: 'expense', amount: 350, n: 1, cat: 'Transport', note: 'Grab' },
    { w: 1, type: 'expense', amount: 1500, n: 9, cat: 'Transport', note: 'BTS top-up' },
    { w: 1, type: 'expense', amount: 3290, n: 5, cat: 'Shopping', note: 'Uniqlo' },
    { w: 1, type: 'expense', amount: 419, n: 8, cat: 'Subscriptions', note: 'Netflix' },
    { w: 1, type: 'expense', amount: 599, n: 4, cat: 'Utilities', note: 'AIS Fibre' },
    { w: 1, type: 'expense', amount: 800, n: 14, cat: 'Health', note: 'Pharmacy' },
    { w: 1, type: 'expense', amount: 1200, n: 10, cat: 'Entertainment', note: 'Cinema' },
    { w: 1, type: 'transfer', amount: 10000, n: 13, note: 'ATM withdrawal', to: 0 },
    { w: 2, type: 'income', amount: 5000, n: 7, cat: 'Fees', note: 'Client fee — VAT return' },
    { w: 2, type: 'income', amount: 1200, n: 15, cat: 'Dividend', note: 'Dividend — UK Ltd' },
    { w: 2, type: 'expense', amount: 45, n: 11, cat: 'Transport', note: 'Train to London' },
  ];
  const bills = [
    { name: 'Council Tax', amount: 142, currency: 'GBP', w: 2, cat: 'Housing', dueDay: d },
    { name: 'Electricity (MEA)', amount: 1240, currency: 'THB', w: 1, cat: 'Utilities', dueDay: d },
    { name: 'Xero subscription', amount: 33, currency: 'GBP', w: 2, cat: 'Subscriptions', dueDay: Math.min(d + 2, 28), isSubscription: true },
    { name: 'AIS Fibre', amount: 599, currency: 'THB', w: 1, cat: 'Utilities', dueDay: Math.max(1, d - 4), paidThrough: dayAgo(4) },
    { name: 'Netflix', amount: 419, currency: 'THB', w: 1, cat: 'Subscriptions', dueDay: Math.max(1, d - 8), paidThrough: dayAgo(8), isSubscription: true },
    { name: 'Car insurance', amount: 620, currency: 'GBP', w: 2, cat: 'Transport', dueDay: 15, frequency: 'yearly' as const, dueMonth: ((m + 1) % 12) + 1 },
  ];
  return { txs: txs.map((t) => ({ ...t, date: dayAgo(t.n) })), bills };
}

/** A few realistic tasks so a fresh install shows the Tasks screen at work. Keyed by child area nameEn. */
function sampleTasks(today: Date) {
  const day = (n: number) => toDateKey(addDays(today, n));
  const check = (text: string, done = false) => ({ id: newId(), text, done });
  return [
    { title: 'Send engagement letter', date: day(-1), priority: 1, area: 'Clients' },
    { title: 'Prepare VAT reconciliation', date: day(0), priority: 1, energy: 'high' as const, area: 'Tax',
      checklist: [check('Export bank feed from Xero', true), check('Match purchase invoices'), check('Review VAT control account')] },
    { title: 'Review CIMA SCS case notes', date: day(0), priority: 2, energy: 'med' as const, area: 'CIMA' },
    { title: 'Reply to client about bank feed', date: day(0), startTime: '16:00', priority: 2, area: 'Clients' },
    { title: 'Book dentist appointment', date: day(0), priority: 3, area: 'Health', isDone: true },
    { title: 'Renew UK car insurance', date: day(2), priority: 2, area: 'Finance' },
    { title: 'Draft Q4 marketing post', date: day(5), priority: 3, energy: 'low' as const, area: 'Marketing' },
    { title: 'Read “The Psychology of Money” ch. 3', priority: 3, energy: 'low' as const, area: 'Reading' },
  ];
}

/** Sample calendar for a fresh install. Times are local; `with` links a contact. */
function sampleEvents(today: Date) {
  const at = (dayOffset: number, hhmm: string) => {
    const d = addDays(today, dayOffset);
    const [h, m] = hhmm.split(':').map(Number);
    return new Date(d.getFullYear(), d.getMonth(), d.getDate(), h, m).getTime();
  };
  // All-day events are stored at UTC midnight so their date survives a timezone change (see `allDayKey`).
  const allDay = (dayOffset: number) => {
    const key = toDateKey(addDays(today, dayOffset));
    return { start: utcDayStart(key)!, end: utcDayStart(key, 1)!, isAllDay: true };
  };
  return [
    { title: 'Team meeting', start: at(0, '09:00'), end: at(0, '10:00'), location: 'Google Meet' },
    { title: 'Client call — John', start: at(0, '10:30'), end: at(0, '11:15'), location: 'Zoom', with: 'John' },
    { title: 'Lunch', start: at(0, '12:00'), end: at(0, '13:00') },
    { title: 'Focus work — client proposal', start: at(0, '13:00'), end: at(0, '15:00') },
    { title: 'Review & preparation', start: at(0, '15:00'), end: at(0, '15:45'), with: 'Sarah' },
    { title: 'Tax planning call', start: at(0, '16:30'), end: at(0, '17:00'), location: 'Somchai Trading Co., Ltd.' },
    { title: 'Meeting with John — VAT', start: at(1, '10:00'), end: at(1, '11:00'), location: 'Office', with: 'John' },
    { title: 'Mum’s birthday', ...allDay(2) },
    { title: 'CIMA study group', start: at(3, '14:00'), end: at(3, '16:00'), location: 'Library' },
  ];
}

/** Sample notes (markdown) for a fresh install. */
const sampleNotes = [
  {
    title: 'Client meeting notes — John',
    pinned: true,
    tags: ['work', 'client'],
    body: ['## Agenda', '- VAT return Q3 — confirm figures', '- Engagement letter for FY2026', '', '## Actions', '- [ ] Send engagement letter', '- [x] Share Xero access', '- [ ] Call John Fri 2pm to confirm VAT £5,000', '', '> John prefers email over LINE.'].join('\n'),
  },
  {
    title: 'CIMA SCS study plan',
    pinned: true,
    tags: ['study', 'cima'],
    body: ['Exam window: **November**. Focus on the pre-seen and _strategic_ analysis.', '', '## This week', '- [ ] Read the pre-seen industry section', '- [ ] Mock exam 1 — timed', '- [ ] Review answers with the study group', '', '## Tips', '1. Plan answers before writing', '2. Use the pre-seen numbers'].join('\n'),
  },
  {
    title: 'Travel plan — Tokyo',
    pinned: false,
    tags: ['travel', 'personal'],
    body: ['Flights booked, hotel in Shinjuku.', '', '- Day 1: Asakusa, Senso-ji', '- Day 2: Shibuya, Harajuku', '- Day 3: Day trip to Kamakura', '', '## To book', '- [ ] JR Pass', '- [ ] teamLab tickets'].join('\n'),
  },
  {
    title: 'ภาษีเงินได้ — เตรียมยื่น',
    pinned: false,
    tags: ['tax'],
    body: ['## เอกสารที่ต้องเตรียม', '- [ ] หนังสือรับรองการหักภาษี ณ ที่จ่าย', '- [x] ใบเสร็จเบี้ยประกัน', '- [ ] สรุปรายได้ค่าบริการ', '', 'พรุ่งนี้ 10 โมง นัดคุณสมชาย คุยเรื่องภาษี'].join('\n'),
  },
  {
    title: 'Ideas — app features',
    pinned: false,
    tags: ['ideas'],
    body: ['- Slip OCR for Thai bank transfers', '- Weekly review with Veyra', '- LINE bot for quick capture'].join('\n'),
  },
];

/** Reference data every install needs: life areas, categories and starter accounts. */
export async function seedIfEmpty(db: Db) {
  const [{ value: areaCount }] = await db.select({ value: count() }).from(areas).all();
  if (areaCount > 0) return;

  const areaRows: (typeof areas.$inferInsert)[] = [];
  let order = 0;
  for (const a of defaultAreas) {
    const parentId = newId();
    areaRows.push({ id: parentId, nameTh: a.nameTh, nameEn: a.nameEn, color: a.color, icon: a.icon, sortOrder: order++, ...stamp() });
    for (const c of a.children) {
      areaRows.push({ id: newId(), nameTh: c.nameTh, nameEn: c.nameEn, parentId, color: a.color, sortOrder: order++, ...stamp() });
    }
  }
  await commit([
    db.insert(areas).values(areaRows),
    db.insert(categories).values(defaultCategories.map((c, i) => ({ id: newId(), ...c, sortOrder: i, ...stamp() }))),
    db.insert(wallets).values(defaultWallets.map((w, i) => ({ id: newId(), ...w, sortOrder: i, ...stamp() }))),
  ], db);
}

/**
 * Optional sample content (chosen during onboarding): tasks, events, notes, a month
 * of money, bills and budgets. Does nothing if the user already has any content.
 * Returns whether anything was added.
 */
export async function seedSampleData(db: Db): Promise<boolean> {
  const has = async (t: typeof tasks | typeof notes | typeof transactions | typeof calendarEvents) => (await db.select({ value: count() }).from(t).all())[0].value > 0;
  if ((await has(tasks)) || (await has(notes)) || (await has(transactions)) || (await has(calendarEvents))) return false;

  const areaIds = new Map((await db.select({ id: areas.id, name: areas.nameEn }).from(areas).all()).map((a) => [a.name, a.id]));
  const catIds = new Map((await db.select({ id: categories.id, name: categories.nameEn }).from(categories).all()).map((c) => [c.name, c.id]));
  const walletRows = await db.select().from(wallets).orderBy(wallets.sortOrder).all();
  if (walletRows.length < defaultWallets.length) return false;

  const writes: Write[] = [];
  walletRows.slice(0, defaultWallets.length).forEach((w, i) => {
    writes.push(db.update(wallets).set({ balance: sampleOpening[i] ?? 0 }).where(eq(wallets.id, w.id)));
  });
  for (const [name, amount] of Object.entries(sampleBudgets)) {
    const id = catIds.get(name);
    if (id) writes.push(db.update(categories).set({ budgetMonthly: amount }).where(eq(categories.id, id)));
  }

  const people = new Map<string, string>();
  sampleEvents(new Date()).forEach(({ with: person, ...e }) => {
    const s = stamp();
    const id = newId();
    writes.push(db.insert(calendarEvents).values({ id, externalId: id, source: 'veyra', location: null, isAllDay: false, ...e, ...s }));
    if (!person) return;
    if (!people.has(person)) {
      people.set(person, newId());
      writes.push(db.insert(contacts).values({ id: people.get(person)!, name: person, ...s }));
    }
    writes.push(db.insert(links).values({ id: newId(), fromType: 'event', fromId: id, toType: 'contact', toId: people.get(person)!, relation: 'with', ...s }));
  });
  sampleNotes.forEach((n, i) => {
    const s = stamp();
    // Stagger updatedAt so "recently edited" ordering looks natural.
    writes.push(db.insert(notes).values({ id: newId(), ...n, createdAt: s.createdAt - i * 3_600_000, updatedAt: s.updatedAt - i * 3_600_000 }));
  });
  sampleTasks(new Date()).forEach(({ area, isDone, ...task }, i) => {
    const s = stamp();
    writes.push(db.insert(tasks).values({ id: newId(), ...task, areaId: areaIds.get(area) ?? null, isDone: !!isDone, doneAt: isDone ? s.createdAt : null, sortOrder: i, ...s }));
  });

  const walletIds = walletRows.map((w) => w.id);
  const money = sampleMoney(new Date());
  money.txs.forEach((t) => {
    writes.push(
      db.insert(transactions).values({
        id: newId(),
        walletId: walletIds[t.w],
        toWalletId: t.to !== undefined ? walletIds[t.to] : null,
        amount: t.amount,
        currency: walletRows[t.w].currency,
        type: t.type,
        categoryId: t.cat ? (catIds.get(t.cat) ?? null) : null,
        date: t.date,
        note: t.note,
        ...stamp(),
      }),
    );
  });
  money.bills.forEach(({ w, cat, ...b }) => {
    writes.push(db.insert(recurringBills).values({ id: newId(), ...b, walletId: walletIds[w], categoryId: catIds.get(cat) ?? null, ...stamp() }));
  });

  await commit(writes, db);
  return true;
}
