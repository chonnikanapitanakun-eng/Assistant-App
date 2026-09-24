import type { TintName } from '@/theme';

/**
 * Prototype data for the Home dashboard (events, bills). Tasks are live.
 * Replace the rest with queries once Calendar and Money are built.
 */
export type EventKind = 'meeting' | 'focus' | 'personal';
export type HomeEvent = { id: string; start: string; end: string; title: string; meta?: string; kind: EventKind };
export type HomeBill = { id: string; name: string; amount: number; currency: string; due: string; dueToday: boolean; icon: 'home' | 'zap' | 'repeat' };

/** Fixed "now" so the prototype always looks the same. */
export const mockNow = (() => {
  const d = new Date();
  d.setHours(10, 5, 0, 0);
  return d;
})();

export const user = { firstName: 'Proud' };

export const events: HomeEvent[] = [
  { id: 'e1', start: '09:00', end: '10:00', title: 'Team meeting', meta: 'Weekly sync · Google Meet', kind: 'meeting' },
  { id: 'e2', start: '10:30', end: '11:15', title: 'Client call — John', meta: 'VAT return · £5,000', kind: 'meeting' },
  { id: 'e3', start: '12:00', end: '13:00', title: 'Lunch', kind: 'personal' },
  { id: 'e4', start: '13:00', end: '15:00', title: 'Focus work', meta: 'Client proposal', kind: 'focus' },
  { id: 'e5', start: '15:00', end: '15:45', title: 'Review & preparation', meta: 'with Sarah', kind: 'meeting' },
  { id: 'e6', start: '16:30', end: '17:00', title: 'Tax planning call', meta: 'Somchai Trading Co., Ltd.', kind: 'meeting' },
];

export const bills: HomeBill[] = [
  { id: 'b1', name: 'Council Tax', amount: 142, currency: 'GBP', due: 'Due today', dueToday: true, icon: 'home' },
  { id: 'b2', name: 'Electricity (MEA)', amount: 1240, currency: 'THB', due: 'Due today', dueToday: true, icon: 'zap' },
  { id: 'b3', name: 'Xero subscription', amount: 33, currency: 'GBP', due: 'Fri, 26 Sep', dueToday: false, icon: 'repeat' },
];

export const eventTint: Record<EventKind, TintName> = { meeting: 'meeting', focus: 'focus', personal: 'personal' };

export const toMinutes = (hhmm: string) => {
  const [h, m] = hhmm.split(':').map(Number);
  return h * 60 + m;
};

export function scheduleStatus(now: Date) {
  const mins = now.getHours() * 60 + now.getMinutes();
  const current = events.find((e) => toMinutes(e.start) <= mins && mins < toMinutes(e.end));
  const next = events.find((e) => toMinutes(e.start) > mins);
  return { mins, currentId: current?.id, nextId: next?.id, nextIn: next ? toMinutes(next.start) - mins : undefined };
}
