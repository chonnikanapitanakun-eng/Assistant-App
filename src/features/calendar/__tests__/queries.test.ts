import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('@/db', () => import('@/db/__tests__/mock-db'));
vi.mock('@/features/notifications', () => ({
  syncTaskReminder: vi.fn().mockResolvedValue(undefined),
  cancelTaskReminder: vi.fn().mockResolvedValue(undefined),
  syncEventReminder: vi.fn().mockResolvedValue(undefined),
  cancelEventReminder: vi.fn().mockResolvedValue(undefined),
}));

const { resetDb } = await import('@/db/__tests__/mock-db');
const { db, calendarEvents, links, contacts } = await import('@/db');
const { createEvent, updateEvent, deleteEvent, moveItem } = await import('../queries');
const { createTask, getTask } = await import('@/features/tasks/queries');
const { eq, and, isNull } = await import('drizzle-orm');

beforeEach(() => {
  resetDb();
});

const values = (over: Partial<Parameters<typeof createEvent>[0]> = {}) => ({
  title: 'ประชุมลูกค้า',
  date: '2026-09-25',
  allDay: false,
  startTime: '09:00',
  endTime: '10:30',
  location: null,
  contactName: null,
  repeat: null,
  remindBefore: null,
  ...over,
});

describe('createEvent', () => {
  it('converts date + time range into start/end epoch ms', async () => {
    const id = await createEvent(values());
    const event = await db.select().from(calendarEvents).where(eq(calendarEvents.id, id)).get();
    const start = new Date(event!.start);
    const end = new Date(event!.end);
    expect(start.getHours()).toBe(9);
    expect(end.getHours()).toBe(10);
    expect(end.getMinutes()).toBe(30);
    expect(event?.isAllDay).toBe(false);
  });

  it('spans the whole day for an all-day event', async () => {
    const id = await createEvent(values({ allDay: true }));
    const event = await db.select().from(calendarEvents).where(eq(calendarEvents.id, id)).get();
    expect(event!.end - event!.start).toBe(24 * 60 * 60 * 1000);
    expect(event?.isAllDay).toBe(true);
  });

  it('links a mentioned contact and creates it if new', async () => {
    const id = await createEvent(values({ contactName: 'คุณเอ' }));
    const rows = await db
      .select({ name: contacts.name })
      .from(links)
      .innerJoin(contacts, eq(contacts.id, links.toId))
      .where(and(eq(links.fromType, 'event'), eq(links.fromId, id), isNull(links.deletedAt)))
      .all();
    expect(rows.map((r) => r.name)).toEqual(['คุณเอ']);
  });
});

describe('updateEvent', () => {
  it('replaces the contact link (soft-deletes the old one)', async () => {
    const id = await createEvent(values({ contactName: 'คุณเอ' }));
    await updateEvent(id, values({ contactName: 'คุณบี' }));
    const live = await db
      .select({ name: contacts.name })
      .from(links)
      .innerJoin(contacts, eq(contacts.id, links.toId))
      .where(and(eq(links.fromType, 'event'), eq(links.fromId, id), isNull(links.deletedAt)))
      .all();
    expect(live.map((r) => r.name)).toEqual(['คุณบี']);
  });

  it('clearing the contact name removes the link', async () => {
    const id = await createEvent(values({ contactName: 'คุณเอ' }));
    await updateEvent(id, values({ contactName: null }));
    const live = await db.select().from(links).where(and(eq(links.fromType, 'event'), eq(links.fromId, id), isNull(links.deletedAt))).all();
    expect(live).toHaveLength(0);
  });

  it('updates title/location/time', async () => {
    const id = await createEvent(values());
    await updateEvent(id, values({ title: 'เลื่อนประชุม', location: 'ออนไลน์', startTime: '14:00', endTime: '15:00' }));
    const event = await db.select().from(calendarEvents).where(eq(calendarEvents.id, id)).get();
    expect(event).toMatchObject({ title: 'เลื่อนประชุม', location: 'ออนไลน์' });
    expect(new Date(event!.start).getHours()).toBe(14);
  });
});

describe('deleteEvent', () => {
  it('soft-deletes', async () => {
    const id = await createEvent(values());
    await deleteEvent(id);
    const event = await db.select().from(calendarEvents).where(eq(calendarEvents.id, id)).get();
    expect(event?.deletedAt).toBeTypeOf('number');
  });
});

describe('moveItem', () => {
  it('moves an event to a new time on the same day', async () => {
    const id = await createEvent(values());
    await moveItem({ kind: 'event', id, title: 'x', date: '2026-09-25', allDay: false }, '13:00', '14:00');
    const event = await db.select().from(calendarEvents).where(eq(calendarEvents.id, id)).get();
    expect(new Date(event!.start).getHours()).toBe(13);
    expect(new Date(event!.end).getHours()).toBe(14);
  });

  it('delegates a task move to rescheduleTask (date + time both change)', async () => {
    const taskId = await createTask({
      title: 'ส่งรายงาน',
      notes: null,
      date: '2026-09-25',
      startTime: '09:00',
      endTime: '10:00',
      priority: 2,
      energy: null,
      areaId: null,
      isDone: false,
      checklist: null,
      remindBefore: null,
      repeat: null,
    });
    await moveItem({ kind: 'task', id: taskId, title: 'x', date: '2026-09-25', allDay: false }, '15:00', '16:00');
    const task = await getTask(taskId);
    expect(task?.startTime).toBe('15:00');
    expect(task?.endTime).toBe('16:00');
  });
});
