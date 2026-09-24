import { useTranslation } from 'react-i18next';
import { View } from 'react-native';

import { Card, Gradient, Text } from '@/components/ui';
import { useTheme } from '@/theme';

/** Today's progress. Gradient only on the filled bar — a small, earned highlight. */
export function ProgressCard({ done, total }: { done: number; total: number }) {
  const { t } = useTranslation();
  const { colors, spacing, radius } = useTheme();
  const ratio = total ? done / total : 0;
  const left = total - done;
  return (
    <Card style={{ gap: spacing.md }}>
      <View style={{ flexDirection: 'row', alignItems: 'flex-end', justifyContent: 'space-between' }}>
        <View style={{ gap: 2 }}>
          <Text variant="overline" color="textSecondary">{t('tasks.today_progress').toUpperCase()}</Text>
          <Text variant="number">
            {done}
            <Text variant="heading" color="textSecondary"> / {total}</Text>
          </Text>
        </View>
        <Text variant="label" color="textSecondary">
          {total === 0 ? t('tasks.nothing_today') : left === 0 ? t('tasks.all_done_today') : t('tasks.left_today', { count: left })}
        </Text>
      </View>
      <View
        accessibilityRole="progressbar"
        accessibilityValue={{ min: 0, max: total, now: done }}
        style={{ height: 8, borderRadius: radius.pill, backgroundColor: colors.surfaceMuted, overflow: 'hidden' }}
      >
        {ratio > 0 ? <Gradient variant="ai" style={{ width: `${Math.round(ratio * 100)}%`, height: '100%', borderRadius: radius.pill }} /> : null}
      </View>
    </Card>
  );
}
