import { useTranslation } from 'react-i18next';
import { View } from 'react-native';

import { Mascot } from '@/components/brand/mascot';
import { Screen, Text } from '@/components/ui';
import { useTheme } from '@/theme';

/** Placeholder for screens that will be designed next. */
export function ComingSoon({ title }: { title: string }) {
  const { t } = useTranslation();
  const { spacing } = useTheme();
  return (
    <Screen>
      <Text variant="title" accessibilityRole="header">{title}</Text>
      <View style={{ alignItems: 'center', gap: spacing.md, paddingVertical: spacing.huge }}>
        <Mascot pose="working" size={120} />
        <Text variant="heading" align="center">{t('common.coming_soon')}</Text>
        <Text variant="bodySm" color="textSecondary" align="center">{t('common.coming_soon_body')}</Text>
      </View>
    </Screen>
  );
}
