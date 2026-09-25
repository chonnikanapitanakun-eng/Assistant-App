import { useTranslation } from 'react-i18next';
import { View } from 'react-native';

import { Text } from '@/components/ui';
import { useTheme } from '@/theme';

/** AI calls used this month against the fair-use cap. */
export function UsageMeter({ used, limit }: { used: number | null; limit: number }) {
  const { t } = useTranslation();
  const { colors, radius, spacing } = useTheme();
  const share = used === null ? 0 : Math.min(1, used / limit);
  return (
    <View style={{ gap: spacing.xs }}>
      <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
        <Text variant="label">{t('premium.usage_title')}</Text>
        <Text variant="label" color="textSecondary">{used === null ? '—' : t('premium.usage_count', { used, limit })}</Text>
      </View>
      <View accessibilityRole="progressbar" accessibilityValue={{ min: 0, max: limit, now: used ?? 0 }} style={{ height: 8, borderRadius: radius.sm, backgroundColor: colors.surfaceMuted, overflow: 'hidden' }}>
        <View style={{ width: `${share * 100}%`, height: '100%', backgroundColor: share >= 1 ? colors.danger : colors.primary }} />
      </View>
      <Text variant="caption" color="textTertiary">{t('premium.usage_hint')}</Text>
    </View>
  );
}
