import type { CaptureItem } from '@/features/ai/types';

/** One block in a day plan. `reason` is the planner's one-line why (empty from the local planner). */
export type PlanRow = { taskId: string; title: string; startTime: string; endTime: string; reason: string; overdue?: boolean; priority?: number };

/** Something Veyra offers to do. Nothing changes until the user confirms. */
export type Proposal =
  | { kind: 'create'; items: CaptureItem[] }
  | { kind: 'complete_task'; taskId: string; title: string }
  | { kind: 'reschedule_task'; taskId: string; title: string; date: string; startTime?: string; endTime?: string }
  /** A whole day laid out by ai-plan (or the local planner). The user can drop rows before confirming; confirming moves every remaining task. */
  | { kind: 'apply_plan'; date: string; slots: PlanRow[]; skipped: { taskId: string; title: string; reason: string }[] }
  | { kind: 'pay_bill'; billId: string; name: string; amount: number; currency: string };

export type ProposalState = 'pending' | 'done' | 'dismissed' | 'failed';

export type ListRow = { id: string; kind: 'task' | 'event' | 'bill'; title: string; meta?: string; tone?: 'danger' | 'warning' | 'muted' };

export type Card =
  | { type: 'list'; title?: string; rows: ListRow[] }
  | { type: 'stats'; rows: { label: string; value: string; hint?: string; tone?: 'danger' | 'warning' | 'good' }[] }
  | { type: 'proposal'; id: string; proposal: Proposal; state: ProposalState };

export type Reply = { text: string; cards: Card[]; suggestions: string[]; source: 'local' | 'claude' };

/** Snapshot of the user's data the assistant can see (built by use-context.ts). */
export type AssistantContext = {
  now: Date;
  name: string;
  currency: string;
  tasks: { id: string; title: string; date: string | null; startTime: string | null; endTime: string | null; isDone: boolean; priority: number; durationMin?: number | null; energy?: 'low' | 'med' | 'high' | null }[];
  /** Today's and upcoming events (local times). */
  events: { id: string; title: string; date: string; start?: string; end?: string; allDay: boolean; location?: string | null }[];
  bills: { id: string; name: string; amount: number; currency: string; due: string; state: 'overdue' | 'today' | 'soon' | 'later' }[];
  /** This month, in the primary currency. */
  money: { income: number; expense: number; categories: { name: string; spent: number; budget: number | null }[] };
};

/** Translation function (i18next-compatible) so the engine stays pure and testable. */
export type T = (key: string, opts?: Record<string, unknown>) => string;
