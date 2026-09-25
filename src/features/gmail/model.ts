import type { TaskFormValues } from '@/features/tasks/queries';
import { addDays, toDateKey } from '@/lib/date';

import type { InboxAccount, InboxThread } from './types';

export type InboxRow = InboxThread & { accountId: string; accountEmail: string };

/** Every account's waiting threads in one list, newest first. */
export function mergeInbox(accounts: InboxAccount[]): InboxRow[] {
  return accounts
    .flatMap((a) => (a.threads ?? []).map((t) => ({ ...t, accountId: a.id, accountEmail: a.email })))
    .sort((a, b) => b.lastAt - a.lastAt);
}

/** Whole days the thread has waited (0 = today). */
export const waitingDays = (lastAt: number, now = Date.now()) => Math.max(0, Math.floor((now - lastAt) / 86_400_000));

export const FOLLOW_UP_TIME = '09:00';

/** A task that reminds the person to chase a thread `days` from `today`, at 09:00. */
export function followUpTask(row: Pick<InboxRow, 'subject' | 'from' | 'accountEmail'>, days: number, title: string, today = new Date()): TaskFormValues {
  const who = row.from.name ? `${row.from.name} <${row.from.email}>` : row.from.email;
  return {
    title,
    notes: `Gmail · ${row.accountEmail}\n${who}\n${row.subject}`,
    date: toDateKey(addDays(today, days)),
    startTime: FOLLOW_UP_TIME,
    endTime: null,
    priority: 2,
    energy: null,
    areaId: null,
    isDone: false,
    checklist: null,
    remind: true,
  };
}

/** Open the thread in Gmail on the web (the right account via `authuser`). */
export const gmailThreadUrl = (accountEmail: string, threadId: string) => `https://mail.google.com/mail/?authuser=${encodeURIComponent(accountEmail)}#all/${threadId}`;
