import type { IconName } from '@/components/ui';

export type NavItem = { name: string; labelKey: string; icon: IconName };

/** Tab routes in src/app/(tabs). Order = sidebar order. */
export const navItems: NavItem[] = [
  { name: 'index', labelKey: 'nav.home', icon: 'home' },
  { name: 'tasks', labelKey: 'nav.tasks', icon: 'check-square' },
  { name: 'calendar', labelKey: 'nav.calendar', icon: 'calendar' },
  { name: 'notes', labelKey: 'nav.notes', icon: 'file-text' },
  { name: 'money', labelKey: 'nav.money', icon: 'credit-card' },
];

/** Mobile bottom bar: two items, the centre AI button, two items. */
export const mobileTabs = { left: ['index', 'tasks'], right: ['calendar', 'money'] } as const;
