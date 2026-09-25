import type { IconName } from '@/components/ui';

import { ruleDays, ruleKind, WEEK_ORDER, type Period } from './model';

export const periodIcon: Record<Period, IconName> = { morning: 'sunrise', day: 'sun', night: 'moon' };

type T = (key: string) => string;

// 2026-01-04 is a Sunday, so day d (0 = Sunday) is 2026-01-(4 + d).
export const dayName = (day: number, lang: string, width: 'short' | 'narrow' = 'short') =>
  new Date(2026, 0, 4 + day).toLocaleDateString(lang === 'th' ? 'th-TH' : 'en-GB', { weekday: width });

/** "Every day" / "Weekdays" / "Weekends" / "Mon · Wed · Fri". */
export function ruleLabel(rule: string, t: T, lang: string): string {
  const kind = ruleKind(rule);
  if (kind !== 'custom') return t(`routines.rule_${kind}`);
  const days = ruleDays(rule);
  return WEEK_ORDER.filter((d) => days.includes(d)).map((d) => dayName(d, lang)).join(' · ');
}
