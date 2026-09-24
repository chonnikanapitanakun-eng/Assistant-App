import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { View } from 'react-native';

import { Chip, Screen, Text } from '@/components/ui';
import { useTheme } from '@/theme';

const views = ['day', 'week', 'month'] as const;

export default function CalendarScreen() {
  const { t } = useTranslation();
  const { spacing } = useTheme();
  const [view, setView] = useState<(typeof views)[number]>('day');

  return (
    <Screen>
      <Text variant="title" accessibilityRole="header">{t('nav.calendar')}</Text>
      <View style={{ flexDirection: 'row', gap: spacing.sm }}>
        {views.map((v) => (
          <Chip key={v} label={t(`plan.${v}`)} selected={view === v} onPress={() => setView(v)} />
        ))}
      </View>
      <Text color="textSecondary">{t('common.coming_soon')}</Text>
    </Screen>
  );
}
