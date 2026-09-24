import type { IconName } from '@/components/ui';

/** Seeded category icons are Ionicons names; map them to our Feather set. */
const map: Record<string, IconName> = {
  restaurant: 'coffee',
  car: 'navigation',
  home: 'home',
  flash: 'zap',
  repeat: 'repeat',
  bag: 'shopping-bag',
  medkit: 'heart',
  school: 'book-open',
  'game-controller': 'film',
  gift: 'gift',
  document: 'file-text',
  'ellipsis-horizontal': 'more-horizontal',
  cash: 'briefcase',
  receipt: 'file-plus',
  'trending-up': 'trending-up',
  'stats-chart': 'bar-chart-2',
  'add-circle': 'plus-circle',
};

export const categoryIcon = (icon: string | null | undefined): IconName => (icon && map[icon]) || 'tag';

export const walletIcon: Record<'cash' | 'bank' | 'card' | 'investment', IconName> = {
  cash: 'dollar-sign',
  bank: 'briefcase',
  card: 'credit-card',
  investment: 'trending-up',
};
