import { useTranslation } from 'react-i18next';
import { View } from 'react-native';

import { Icon, Text } from '@/components/ui';
import { formatMoney } from '@/lib/currency';
import { useTheme } from '@/theme';

import { categoryIcon } from '../category-icon';

type Row = { categoryId: string | null; total: number };
type Cat = { id: string; nameEn: string; nameTh: string; icon: string | null };

/**
 * Spending by category — one series, so one hue (`chart`), horizontal bars
 * ≤ 24px from a shared baseline, 4px rounded data-end, value labelled at the tip
 * in text tokens. Top 5 + "Other" so it never needs a second hue.
 */
export function SpendingChart({ rows, categories, currency }: { rows: Row[]; categories: Cat[]; currency: string }) {
  const { t, i18n } = useTranslation();
  const { colors, spacing } = useTheme();
  const byId = new Map(categories.map((c) => [c.id, c]));
  const top = rows.slice(0, 5);
  const rest = rows.slice(5).reduce((s, r) => s + r.total, 0);
  const data = rest > 0 ? [...top, { categoryId: '__other', total: rest }] : top;
  const max = Math.max(...data.map((d) => d.total), 1);
  const name = (id: string | null) => {
    if (id === '__other') return t('money.other');
    const c = id ? byId.get(id) : undefined;
    return c ? (i18n.language === 'th' ? c.nameTh : c.nameEn) : t('money.uncategorised');
  };

  return (
    <View accessibilityRole="summary" style={{ gap: spacing.md }}>
      {data.map((d) => {
        const label = name(d.categoryId);
        const value = formatMoney(d.total, currency, 'en-GB');
        return (
          <View key={d.categoryId ?? 'none'} accessible accessibilityLabel={`${label}: ${value}`} style={{ gap: 6 }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.sm }}>
              <Icon name={d.categoryId === '__other' ? 'more-horizontal' : categoryIcon(byId.get(d.categoryId ?? '')?.icon)} size={14} color="textSecondary" />
              <Text variant="label" style={{ flex: 1 }} numberOfLines={1}>{label}</Text>
              <Text variant="label" weight="semibold" style={{ fontVariant: ['tabular-nums'] }}>{value}</Text>
            </View>
            <View style={{ height: 10, borderRadius: 2, backgroundColor: colors.surfaceMuted }}>
              <View style={{ width: `${Math.max((d.total / max) * 100, 2)}%`, height: '100%', backgroundColor: colors.chart, borderTopLeftRadius: 2, borderBottomLeftRadius: 2, borderTopRightRadius: 4, borderBottomRightRadius: 4 }} />
            </View>
          </View>
        );
      })}
    </View>
  );
}
