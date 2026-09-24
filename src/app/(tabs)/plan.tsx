import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Pressable, View } from 'react-native';

import { Screen, Text } from '@/components/ui';
import { useTheme } from '@/theme';

const views = ['day', 'week', 'month'] as const;

export default function PlanScreen() {
  const { t } = useTranslation();
  const { colors, radius } = useTheme();
  const [view, setView] = useState<(typeof views)[number]>('day');

  return (
    <Screen>
      <Text variant="title">{t('tabs.plan')}</Text>
      <View style={{ flexDirection: 'row', gap: 8 }}>
        {views.map((v) => (
          <Pressable
            key={v}
            onPress={() => setView(v)}
            style={{ paddingVertical: 8, paddingHorizontal: 16, borderRadius: radius.pill, backgroundColor: view === v ? colors.primary : colors.surfaceAlt }}
          >
            <Text color={view === v ? 'onPrimary' : 'text'}>{t(`plan.${v}`)}</Text>
          </Pressable>
        ))}
      </View>
      <Text color="textSecondary">Timeline ({view}) — Phase 1</Text>
    </Screen>
  );
}
