/**
 * Prototype data for the Home dashboard. Events and tasks are live;
 * bills stay mocked until the Money screen is built.
 */
export type HomeBill = { id: string; name: string; amount: number; currency: string; due: string; dueToday: boolean; icon: 'home' | 'zap' | 'repeat' };

export const user = { firstName: 'Proud' };

export const bills: HomeBill[] = [
  { id: 'b1', name: 'Council Tax', amount: 142, currency: 'GBP', due: 'Due today', dueToday: true, icon: 'home' },
  { id: 'b2', name: 'Electricity (MEA)', amount: 1240, currency: 'THB', due: 'Due today', dueToday: true, icon: 'zap' },
  { id: 'b3', name: 'Xero subscription', amount: 33, currency: 'GBP', due: 'Fri, 26 Sep', dueToday: false, icon: 'repeat' },
];
