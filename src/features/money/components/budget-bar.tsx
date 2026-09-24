import { useTranslation } from 'react-i18next';
import { View } from 'react-native';

import { Icon, Text } from '@/components/ui';
import { formatMoney } from '@/lib/currency';
import { useTheme } from '@/theme';

import { budgetStatus, PRIMARY_CURRENCY } from '../model';

/** Budget progress. State is carried by icon + text, never by colour alone. */
export function BudgetBar({ spent, budget }: { spent: number; budget: number }) {
  const { t } = useTranslation();
  const { colors, tints, spacing } = useTheme();
  const s = budgetStatus(spent, budget);
  const fill = s.state === 'over' ? tints.priorityHigh.fg : s.state === 'near' ? tints.priorityMedium.fg : colors.chart;
  const fmt = (n: number) => formatMoney(n, PRIMARY_CURRENCY, 'en-GB');

  return (
    <View style={{ gap: 6 }}>
      <View accessibilityRole="progressbar" accessibilityValue={{ min: 0, max: Math.round(budget), now: Math.round(spent) }} style={{ height: 8, borderRadius: 4, backgroundColor: colors.surfaceMuted, overflow: 'hidden' }}>
        <View style={{ width: `${Math.min(s.ratio, 1) * 100}%`, height: '100%', backgroundColor: fill, borderRadius: 4 }} />
      </View>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.xs }}>
        {s.state !== 'ok' ? <Icon name={s.state === 'over' ? 'alert-octagon' : 'alert-triangle'} size={12} tone={fill} /> : null}
        <Text variant="caption" tone={s.state === 'ok' ? colors.textSecondary : fill} style={{ flex: 1 }}>
          {s.state === 'over' ? t('money.over_by', { amount: fmt(-s.remaining) }) : s.state === 'near' ? t('money.near_limit', { amount: fmt(s.remaining) }) : t('money.left', { amount: fmt(s.remaining) })}
        </Text>
        <Text variant="caption" color="textSecondary" style={{ fontVariant: ['tabular-nums'] }}>
          {fmt(spent)} / {fmt(budget)}
        </Text>
      </View>
    </View>
  );
}
