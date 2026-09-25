import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('@/db', () => import('@/db/__tests__/mock-db'));
vi.mock('@/features/notifications', () => ({
  syncTaskReminder: vi.fn().mockResolvedValue(undefined),
  cancelTaskReminder: vi.fn().mockResolvedValue(undefined),
}));

const { resetDb } = await import('@/db/__tests__/mock-db');
const { syncTaskReminder, cancelTaskReminder } = await import('@/features/notifications');
const { createTask, updateTask, toggleTaskDone, deleteTask, getTask, rescheduleTask } = await import('../queries');

beforeEach(() => {
  resetDb();
  vi.clearAllMocks();
});

const values = (over: Partial<Parameters<typeof createTask>[0]> = {}) => ({
  title: 'ส่งงบการเงิน',
  notes: null,
  date: '2026-09-25',
  startTime: '09:00',
  endTime: '10:00',
  priority: 2,
  energy: null,
  areaId: null,
  isDone: false,
  checklist: null,
  remindBefore: null as number | null,
  repeat: null as 'daily' | 'weekly' | 'monthly' | 'yearly' | null,
  ...over,
});

describe('createTask', () => {
  it('inserts a row and returns its id', async () => {
    const id = await createTask(values());
    const saved = await getTask(id);
    expect(saved?.title).toBe('ส่งงบการเงิน');
    expect(saved?.isDone).toBe(false);
  });

  it('sets doneAt when created already done', async () => {
    const id = await createTask(values({ isDone: true }));
    const saved = await getTask(id);
    expect(saved?.doneAt).toBeTypeOf('number');
  });

  it('leaves doneAt null when not done', async () => {
    const id = await createTask(values());
    const saved = await getTask(id);
    expect(saved?.doneAt).toBeNull();
  });

  it('sets reminderAt from remindBefore (untimed tasks remind at 09:00)', async () => {
    const withReminder = await getTask(await createTask(values({ remindBefore: 0 })));
    expect(withReminder?.reminderAt).toBeTypeOf('number');

    const noRemind = await getTask(await createTask(values({ remindBefore: null })));
    expect(noRemind?.reminderAt).toBeNull();

    const noTime = await getTask(await createTask(values({ remindBefore: 0, startTime: null })));
    expect(noTime?.reminderAt).toBe(new Date(2026, 8, 25, 9, 0).getTime());

    const early = await getTask(await createTask(values({ remindBefore: 30 })));
    expect(early?.reminderAt).toBe(new Date(2026, 8, 25, 8, 30).getTime());

    const noDate = await getTask(await createTask(values({ remindBefore: 0, date: null })));
    expect(noDate?.reminderAt).toBeNull();
  });

  it('syncs a reminder in the background without blocking the caller', async () => {
    await createTask(values({ remindBefore: 0 }));
    expect(syncTaskReminder).toHaveBeenCalledTimes(1);
    expect(syncTaskReminder).toHaveBeenCalledWith(expect.objectContaining({ reminderNotificationId: null }));
  });
});

describe('updateTask', () => {
  it('overwrites fields and bumps updatedAt', async () => {
    const id = await createTask(values());
    const before = await getTask(id);
    await new Promise((r) => setTimeout(r, 2));
    await updateTask(before!, values({ title: 'แก้ไขแล้ว' }));
    const after = await getTask(id);
    expect(after?.title).toBe('แก้ไขแล้ว');
    expect(after!.updatedAt).toBeGreaterThan(before!.updatedAt);
  });

  it('clears doneAt when marking not done', async () => {
    const id = await createTask(values({ isDone: true }));
    const done = await getTask(id);
    await updateTask(done!, values({ isDone: false }));
    const after = await getTask(id);
    expect(after?.doneAt).toBeNull();
  });

  it('keeps the original doneAt when staying done', async () => {
    const id = await createTask(values({ isDone: true }));
    const done = await getTask(id);
    await updateTask(done!, values({ isDone: true, title: 'still done' }));
    const after = await getTask(id);
    expect(after?.doneAt).toBe(done!.doneAt);
  });
});

describe('toggleTaskDone', () => {
  it('flips isDone and stamps/clears doneAt, cancelling or leaving the reminder', async () => {
    const id = await createTask(values({ remindBefore: 0 }));
    const open = await getTask(id);

    await toggleTaskDone(open!);
    const done = await getTask(id);
    expect(done?.isDone).toBe(true);
    expect(done?.doneAt).toBeTypeOf('number');
    expect(syncTaskReminder).toHaveBeenLastCalledWith(expect.objectContaining({ reminderAt: null }));

    await toggleTaskDone(done!);
    const reopened = await getTask(id);
    expect(reopened?.isDone).toBe(false);
    expect(reopened?.doneAt).toBeNull();
  });
});

describe('deleteTask', () => {
  it('soft-deletes: getTask / getAll no longer see it, but the row remains', async () => {
    const id = await createTask(values({ remindBefore: 0 }));
    const task = await getTask(id);
    await deleteTask(task!);
    expect(await getTask(id)).toBeUndefined();
    expect(cancelTaskReminder).toHaveBeenCalledWith(task!.reminderNotificationId);
  });
});

describe('rescheduleTask', () => {
  it('moves date/time and recomputes the reminder for an open task', async () => {
    const id = await createTask(values({ date: '2026-09-25', startTime: '09:00', remindBefore: 0 }));
    const task = await getTask(id);
    await rescheduleTask(task!, '2026-09-26', '11:00', '12:00');
    const after = await getTask(id);
    expect(after?.date).toBe('2026-09-26');
    expect(after?.startTime).toBe('11:00');
    expect(after?.endTime).toBe('12:00');
    expect(after?.reminderAt).toBeTypeOf('number');
  });

  it('drops the reminder for a task that is already done', async () => {
    const id = await createTask(values({ isDone: true }));
    const task = await getTask(id);
    await rescheduleTask(task!, '2026-09-26', '11:00');
    expect((await getTask(id))?.reminderAt).toBeNull();
  });

  it('clears the reminder when no start time is given', async () => {
    const id = await createTask(values());
    const task = await getTask(id);
    await rescheduleTask(task!, '2026-09-27');
    expect((await getTask(id))?.reminderAt).toBeNull();
  });
});

describe('repeating tasks', () => {
  const live = async () => (await import('@/db')).db.select().from((await import('@/db')).tasks).all();

  it('completing spawns the next occurrence (never in the past) with a fresh checklist', async () => {
    const id = await createTask(values({ date: '2020-01-01', repeat: 'daily', checklist: [{ id: 'c', text: 'x', done: true }] }));
    await toggleTaskDone((await getTask(id))!);
    const next = (await live()).find((t) => t.repeatFromId === id);
    expect(next?.date).toBe(new Date(Date.now() + 86_400_000).toLocaleDateString('sv-SE'));
    expect(next?.isDone).toBe(false);
    expect(next?.repeat).toBe('daily');
    expect(next?.checklist).toEqual([{ id: 'c', text: 'x', done: false }]);
  });

  it('keeps the rhythm for future tasks and does not spawn twice', async () => {
    const id = await createTask(values({ date: '2099-01-31', repeat: 'monthly' }));
    const task = (await getTask(id))!;
    await toggleTaskDone(task);
    await toggleTaskDone({ ...task, isDone: false });
    const spawned = (await live()).filter((t) => t.repeatFromId === id && !t.deletedAt);
    expect(spawned.map((t) => t.date)).toEqual(['2099-02-28']);
  });

  it('reopening removes the untouched copy', async () => {
    const id = await createTask(values({ repeat: 'weekly' }));
    await toggleTaskDone((await getTask(id))!);
    await toggleTaskDone((await getTask(id))!);
    expect((await live()).filter((t) => t.repeatFromId === id && !t.deletedAt)).toHaveLength(0);
  });

  it('drops repeat when there is no date', async () => {
    const id = await createTask(values({ date: null, repeat: 'daily' }));
    expect((await getTask(id))?.repeat).toBeNull();
  });
});
