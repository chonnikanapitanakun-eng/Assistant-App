import { beforeEach, describe, expect, it, vi } from 'vitest';

import type { CaptureItem } from '../types';

vi.mock('@/db', () => import('@/db/__tests__/mock-db'));
vi.mock('@/features/notifications', () => ({
  syncTaskReminder: vi.fn().mockResolvedValue(undefined),
  cancelTaskReminder: vi.fn().mockResolvedValue(undefined),
}));

const { resetDb } = await import('@/db/__tests__/mock-db');
const { db, calendarEvents, tasks, transactions, notes, contacts, links, wallets } = await import('@/db');
const { saveCaptureItems } = await import('../save');
const { syncTaskReminder } = await import('@/features/notifications');
const { eq, and, isNull } = await import('drizzle-orm');
const { newId, now } = await import('@/lib/ids');

beforeEach(() => {
  resetDb();
  vi.clearAllMocks();
});

async function seedWallet(currency: string) {
  const t = now();
  const id = newId();
  await db.insert(wallets).values({ id, name: currency, type: 'cash', currency, createdAt: t, updatedAt: t, sortOrder: 0 });
  return id;
}

const linksFor = (fromId: string) => db.select().from(links).where(and(eq(links.fromId, fromId), isNull(links.deletedAt))).all();

describe('saveCaptureItems — events', () => {
  it('a timed event gets a 1-hour default end and isAllDay=false', async () => {
    const items: CaptureItem[] = [{ type: 'event', title: 'นัดลูกค้า', date: '2026-09-25', startTime: '09:00' }];
    const n = await saveCaptureItems(items);
    expect(n).toBe(1);
    const [event] = await db.select().from(calendarEvents).all();
    expect(event.isAllDay).toBe(false);
    expect(event.end - event.start).toBe(60 * 60 * 1000);
  });

  it('an all-day event (no startTime) spans 24 hours', async () => {
    const items: CaptureItem[] = [{ type: 'event', title: 'วันหยุด', date: '2026-09-25' }];
    await saveCaptureItems(items);
    const [event] = await db.select().from(calendarEvents).all();
    expect(event.isAllDay).toBe(true);
    expect(event.end - event.start).toBe(24 * 60 * 60 * 1000);
  });

  it('links a mentioned contact to the event', async () => {
    const items: CaptureItem[] = [{ type: 'event', title: 'นัดลูกค้า', date: '2026-09-25', startTime: '09:00', contactName: 'คุณเอ' }];
    await saveCaptureItems(items);
    const [event] = await db.select().from(calendarEvents).all();
    const eventLinks = await linksFor(event.id);
    expect(eventLinks).toHaveLength(1);
    const [contact] = await db.select().from(contacts).all();
    expect(contact.name).toBe('คุณเอ');
  });
});

describe('saveCaptureItems — tasks', () => {
  it('schedules a reminder only when date+startTime are both present, after the write commits', async () => {
    const items: CaptureItem[] = [
      { type: 'task', title: 'มีเวลา', date: '2026-09-25', startTime: '09:00' },
      { type: 'task', title: 'ไม่มีเวลา' },
    ];
    await saveCaptureItems(items);
    const saved = await db.select().from(tasks).all();
    const timed = saved.find((t) => t.title === 'มีเวลา')!;
    const untimed = saved.find((t) => t.title === 'ไม่มีเวลา')!;
    expect(timed.reminderAt).toBeTypeOf('number');
    expect(untimed.reminderAt).toBeNull();
    expect(syncTaskReminder).toHaveBeenCalledTimes(1);
    expect(syncTaskReminder).toHaveBeenCalledWith(expect.objectContaining({ id: timed.id, reminderNotificationId: null }));
  });
});

describe('saveCaptureItems — money', () => {
  it('picks the wallet matching the currency over the first wallet', async () => {
    await seedWallet('THB');
    const gbp = await seedWallet('GBP');
    const items: CaptureItem[] = [{ type: 'expense', amount: 20, currency: 'GBP', note: 'coffee' }];
    await saveCaptureItems(items);
    const [tx] = await db.select().from(transactions).all();
    expect(tx.walletId).toBe(gbp);
    expect(tx.source).toBe('ai');
  });

  it('falls back to the first wallet when no currency matches', async () => {
    const thb = await seedWallet('THB');
    const items: CaptureItem[] = [{ type: 'income', amount: 1000, currency: 'USD' }];
    await saveCaptureItems(items);
    const [tx] = await db.select().from(transactions).all();
    expect(tx.walletId).toBe(thb);
  });

  it('skips (and does not count) a money item when there is no wallet at all', async () => {
    const items: CaptureItem[] = [{ type: 'expense', amount: 20, currency: 'THB' }];
    const n = await saveCaptureItems(items);
    expect(n).toBe(0);
    expect(await db.select().from(transactions).all()).toHaveLength(0);
  });

  it('defaults the transaction date to today when the item has none', async () => {
    await seedWallet('THB');
    const items: CaptureItem[] = [{ type: 'expense', amount: 20, currency: 'THB' }];
    await saveCaptureItems(items);
    const [tx] = await db.select().from(transactions).all();
    expect(tx.date).toMatch(/^\d{4}-\d{2}-\d{2}$/);
  });
});

describe('saveCaptureItems — notes', () => {
  it('titles the note from the first line, capped at 60 chars', async () => {
    const longLine = 'ก'.repeat(80);
    const items: CaptureItem[] = [{ type: 'note', body: `${longLine}\nรายละเอียดเพิ่มเติม` }];
    await saveCaptureItems(items);
    const [note] = await db.select().from(notes).all();
    expect(note.title).toBe(longLine.slice(0, 60));
    expect(note.body).toBe(`${longLine}\nรายละเอียดเพิ่มเติม`);
  });
});

describe('saveCaptureItems — contacts', () => {
  it('creates a standalone contact for a bare contact item', async () => {
    const items: CaptureItem[] = [{ type: 'contact', name: 'คุณซี' }];
    const n = await saveCaptureItems(items);
    expect(n).toBe(1);
    const saved = await db.select().from(contacts).all();
    expect(saved.map((c) => c.name)).toEqual(['คุณซี']);
  });

  it('de-duplicates a contact mentioned by several items in the same batch (case-insensitive)', async () => {
    const items: CaptureItem[] = [
      { type: 'task', title: 'ตามงาน', contactName: 'คุณดี' },
      { type: 'event', title: 'นัด', date: '2026-09-25', contactName: 'คุณดี' },
      { type: 'contact', name: 'คุณดี' },
    ];
    await saveCaptureItems(items);
    expect(await db.select().from(contacts).all()).toHaveLength(1);
  });

  it('reuses an existing contact instead of creating a duplicate', async () => {
    const t = now();
    await db.insert(contacts).values({ id: newId(), name: 'คุณเอ', createdAt: t, updatedAt: t });
    const items: CaptureItem[] = [{ type: 'task', title: 'ตามงาน', contactName: 'คุณเอ' }];
    await saveCaptureItems(items);
    expect(await db.select().from(contacts).all()).toHaveLength(1);
  });
});

describe('saveCaptureItems — extracted links from a source note', () => {
  it('records where a task/event/transaction was extracted from', async () => {
    await seedWallet('THB');
    const items: CaptureItem[] = [
      { type: 'task', title: 'จากโน้ต', date: '2026-09-25' },
      { type: 'expense', amount: 10, currency: 'THB' },
    ];
    await saveCaptureItems(items, { sourceNoteId: 'note-1' });
    const extracted = await db.select().from(links).where(and(eq(links.fromType, 'note'), eq(links.fromId, 'note-1'), eq(links.relation, 'extracted'))).all();
    expect(extracted).toHaveLength(2);
  });

  it('writes nothing extra when there is no sourceNoteId', async () => {
    const items: CaptureItem[] = [{ type: 'task', title: 'ไม่มีที่มา', date: '2026-09-25' }];
    await saveCaptureItems(items);
    expect(await db.select().from(links).all()).toHaveLength(0);
  });
});

describe('saveCaptureItems — return value', () => {
  it('counts every confirmed item that was actually saved', async () => {
    await seedWallet('THB');
    const items: CaptureItem[] = [
      { type: 'task', title: 'a', date: '2026-09-25' },
      { type: 'note', body: 'b' },
      { type: 'expense', amount: 5, currency: 'THB' },
    ];
    expect(await saveCaptureItems(items)).toBe(3);
  });
});
