/**
 * Drizzle schema — ตรงกับ docs/SPEC.md §6.3
 * ทุกตารางมี base columns สำหรับ sync (Phase 2)
 */
import { index, integer, real, sqliteTable, text, uniqueIndex } from 'drizzle-orm/sqlite-core';

const base = {
  id: text('id').primaryKey(),
  userId: text('user_id'),
  createdAt: integer('created_at').notNull(),
  updatedAt: integer('updated_at').notNull(),
  deletedAt: integer('deleted_at'),
  syncedAt: integer('synced_at'),
};

export const areas = sqliteTable('areas', {
  ...base,
  nameTh: text('name_th').notNull(),
  nameEn: text('name_en').notNull(),
  parentId: text('parent_id'),
  color: text('color'),
  icon: text('icon'),
  sortOrder: integer('sort_order').notNull().default(0),
});

export const contacts = sqliteTable(
  'contacts',
  {
    ...base,
    name: text('name').notNull(),
    company: text('company'),
    role: text('role'),
    email: text('email'),
    phone: text('phone'),
    lineId: text('line_id'),
    areaId: text('area_id'),
    notes: text('notes'),
  },
  (t) => [index('contacts_name_idx').on(t.name)],
);

/** What each generated task gets. Steps become the task's checklist. */
export type RoutineTemplate = {
  startTime?: string | null; // HH:mm
  endTime?: string | null;
  energy?: 'low' | 'med' | 'high' | null;
  steps?: string[];
};

export const routines = sqliteTable('routines', {
  ...base,
  title: text('title').notNull(),
  rule: text('rule').notNull(), // daily | weekly:<days, 0 = Sunday> e.g. weekly:1,3,5 — see features/routines/model.ts
  period: text('period', { enum: ['morning', 'day', 'night'] }),
  template: text('template', { mode: 'json' }).$type<RoutineTemplate>(),
  areaId: text('area_id'),
  active: integer('active', { mode: 'boolean' }).notNull().default(true),
});

export const tasks = sqliteTable(
  'tasks',
  {
    ...base,
    title: text('title').notNull(),
    notes: text('notes'),
    date: text('date'), // YYYY-MM-DD
    startTime: text('start_time'), // HH:mm
    endTime: text('end_time'),
    durationMin: integer('duration_min'),
    isDone: integer('is_done', { mode: 'boolean' }).notNull().default(false),
    doneAt: integer('done_at'),
    priority: integer('priority').notNull().default(2), // 1 high, 2 normal, 3 low
    energy: text('energy', { enum: ['low', 'med', 'high'] }),
    color: text('color'),
    icon: text('icon'),
    areaId: text('area_id'),
    routineId: text('routine_id'),
    checklist: text('checklist', { mode: 'json' }).$type<{ id: string; text: string; done: boolean }[]>(),
    reminderAt: integer('reminder_at'),
    reminderNotificationId: text('reminder_notification_id'),
    remindBefore: integer('remind_before'), // minutes before start (09:00 when untimed); null = no reminder
    repeat: text('repeat', { enum: ['daily', 'weekly', 'monthly', 'yearly'] }), // completing spawns the next one
    repeatFromId: text('repeat_from_id'), // the completed task this one was spawned from
    sortOrder: integer('sort_order').notNull().default(0),
  },
  (t) => [
    index('tasks_date_idx').on(t.date),
    index('tasks_done_idx').on(t.isDone),
    // One task per routine per day (NULL routine_id never collides). Kept after soft delete, so a
    // routine task the user deleted today is not generated again.
    uniqueIndex('tasks_routine_date_uniq').on(t.routineId, t.date),
  ],
);

export const notes = sqliteTable('notes', {
  ...base,
  title: text('title').notNull().default(''),
  body: text('body').notNull().default(''),
  tags: text('tags', { mode: 'json' }).$type<string[]>(),
  pinned: integer('pinned', { mode: 'boolean' }).notNull().default(false),
  attachments: text('attachments', { mode: 'json' }).$type<string[]>(),
  areaId: text('area_id'),
});

export const wallets = sqliteTable('wallets', {
  ...base,
  name: text('name').notNull(),
  type: text('type', { enum: ['cash', 'bank', 'card', 'investment'] }).notNull(),
  currency: text('currency').notNull().default('THB'),
  balance: real('balance').notNull().default(0), // opening balance; current = opening + transactions
  color: text('color'),
  sortOrder: integer('sort_order').notNull().default(0),
  bankCode: text('bank_code'), // Thai bank code (004 = KBank…) — matches slips to this account
  accountDigits: text('account_digits'), // account number or the part a slip shows (xxx-x-x1234-x → 1234)
});

export const categories = sqliteTable('categories', {
  ...base,
  nameTh: text('name_th').notNull(),
  nameEn: text('name_en').notNull(),
  type: text('type', { enum: ['income', 'expense'] }).notNull(),
  icon: text('icon'),
  budgetMonthly: real('budget_monthly'),
  sortOrder: integer('sort_order').notNull().default(0),
});

export const transactions = sqliteTable(
  'transactions',
  {
    ...base,
    walletId: text('wallet_id').notNull(),
    amount: real('amount').notNull(),
    currency: text('currency').notNull().default('THB'),
    type: text('type', { enum: ['income', 'expense', 'transfer'] }).notNull(),
    toWalletId: text('to_wallet_id'),
    categoryId: text('category_id'),
    areaId: text('area_id'),
    date: text('date').notNull(), // YYYY-MM-DD
    note: text('note'),
    slipImage: text('slip_image'),
    source: text('source', { enum: ['manual', 'ai', 'slip', 'line'] }).notNull().default('manual'),
    payee: text('payee'), // from a slip; remembers which category this payee usually goes to
    slipRef: text('slip_ref'), // bank transaction ref — the same slip is never saved twice
  },
  (t) => [index('transactions_date_idx').on(t.date), index('transactions_wallet_idx').on(t.walletId), index('transactions_slip_ref_idx').on(t.slipRef)],
);

export const recurringBills = sqliteTable('recurring_bills', {
  ...base,
  name: text('name').notNull(),
  amount: real('amount').notNull(),
  currency: text('currency').notNull().default('THB'),
  walletId: text('wallet_id'),
  categoryId: text('category_id'),
  dueDay: integer('due_day').notNull(), // 1-31
  frequency: text('frequency', { enum: ['monthly', 'yearly'] }).notNull().default('monthly'),
  remindDaysBefore: integer('remind_days_before').notNull().default(3),
  isSubscription: integer('is_subscription', { mode: 'boolean' }).notNull().default(false),
  dueMonth: integer('due_month'), // 1-12, yearly bills only
  paidThrough: text('paid_through'), // YYYY-MM-DD of the last due date that was paid
  lastPaymentId: text('last_payment_id'), // transaction created by the last "Mark paid" (for undo)
  previousPaidThrough: text('previous_paid_through'),
  reminderNotificationId: text('reminder_notification_id'),
});

export const checkins = sqliteTable('checkins', {
  ...base,
  date: text('date').notNull().unique(),
  mood: integer('mood'), // 1-5
  energy: integer('energy'), // 1-5
  reflection: text('reflection'),
});

export const focusSessions = sqliteTable('focus_sessions', {
  ...base,
  taskId: text('task_id'),
  startedAt: integer('started_at').notNull(),
  durationMin: integer('duration_min').notNull(),
  completed: integer('completed', { mode: 'boolean' }).notNull().default(false),
});

export const calendarEvents = sqliteTable(
  'calendar_events',
  {
    ...base,
    externalId: text('external_id').notNull(),
    source: text('source').notNull().default('google'),
    accountId: text('account_id'), // calendar_accounts.id for imported events; null for Veyra's own
    calendarName: text('calendar_name'),
    title: text('title').notNull(),
    start: integer('start').notNull(),
    end: integer('end').notNull(),
    location: text('location'),
    isAllDay: integer('is_all_day', { mode: 'boolean' }).notNull().default(false),
    repeat: text('repeat', { enum: ['daily', 'weekly', 'monthly', 'yearly'] }), // Veyra events only; the row is the first occurrence
    remindBefore: integer('remind_before'), // minutes before start (09:00 when all-day); null = no reminder
    reminderNotificationId: text('reminder_notification_id'),
  },
  (t) => [index('calendar_events_start_idx').on(t.start), index('calendar_events_account_idx').on(t.accountId, t.externalId)],
);

/** A linked Google account (P2-07). `id` is the server's gcal_accounts.id; tokens stay on the server. */
export const calendarAccounts = sqliteTable('calendar_accounts', {
  ...base,
  email: text('email').notNull(),
  color: text('color').notNull(),
  status: text('status', { enum: ['ok', 'reauth', 'error'] }).notNull().default('ok'),
  lastSyncedAt: integer('last_synced_at'),
});

/** Veyra AI chat history. `payload` holds cards/proposals (and their confirm state). */
export const assistantMessages = sqliteTable(
  'assistant_messages',
  {
    ...base,
    role: text('role', { enum: ['user', 'assistant'] }).notNull(),
    text: text('text').notNull().default(''),
    payload: text('payload', { mode: 'json' }).$type<unknown>(),
  },
  (t) => [index('assistant_messages_created_idx').on(t.createdAt)],
);

export const linkableTypes = ['task', 'note', 'transaction', 'contact', 'event', 'area'] as const;
export type LinkableType = (typeof linkableTypes)[number];

export const links = sqliteTable(
  'links',
  {
    ...base,
    fromType: text('from_type', { enum: linkableTypes }).notNull(),
    fromId: text('from_id').notNull(),
    toType: text('to_type', { enum: linkableTypes }).notNull(),
    toId: text('to_id').notNull(),
    relation: text('relation'),
  },
  (t) => [index('links_from_idx').on(t.fromType, t.fromId), index('links_to_idx').on(t.toType, t.toId)],
);

export type Area = typeof areas.$inferSelect;
export type Contact = typeof contacts.$inferSelect;
export type Routine = typeof routines.$inferSelect;
export type Task = typeof tasks.$inferSelect;
export type NewTask = typeof tasks.$inferInsert;
export type Note = typeof notes.$inferSelect;
export type Wallet = typeof wallets.$inferSelect;
export type Category = typeof categories.$inferSelect;
export type Transaction = typeof transactions.$inferSelect;
export type NewTransaction = typeof transactions.$inferInsert;
export type Link = typeof links.$inferSelect;
export type CalendarEvent = typeof calendarEvents.$inferSelect;
export type CalendarAccount = typeof calendarAccounts.$inferSelect;
export type RecurringBill = typeof recurringBills.$inferSelect;
export type AssistantMessage = typeof assistantMessages.$inferSelect;
export type Checkin = typeof checkins.$inferSelect;
