import { router } from 'expo-router';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ScrollView, View } from 'react-native';

import { Mascot } from '@/components/brand/mascot';
import { Button, Chip, Gradient, Text } from '@/components/ui';
import { useBreakpoint, useTheme } from '@/theme';

/** Proactive AI card. Gradient appears only as a hairline frame — calm, not loud. */
export function AssistantCard() {
  const { t } = useTranslation();
  const { colors, spacing, radius, shadow } = useTheme();
  const { isMobile } = useBreakpoint();
  const [dismissed, setDismissed] = useState(false);
  const open = () => router.push('/assistant');
  const chips = (
    <>
      <Chip label={t('home.ai_plan_day')} icon="sun" onPress={open} />
      <Chip label={t('home.ai_summarise')} icon="list" onPress={open} />
      <Chip label={t('home.ai_overdue')} icon="alert-circle" onPress={open} />
      <Chip label={t('home.ai_expenses')} icon="pie-chart" onPress={open} />
    </>
  );

  return (
    <Gradient style={{ borderRadius: radius.panel, padding: 1.5, boxShadow: shadow.md }}>
      <View style={{ backgroundColor: colors.surface, borderRadius: radius.panel - 1.5, padding: spacing.xl, gap: spacing.lg }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.md }}>
          <Mascot pose="wave" size={52} />
          <View style={{ flex: 1 }}>
            <Text variant="overline" color="primary">VEYRA</Text>
            <Text variant="heading">{t('home.ai_title')}</Text>
          </View>
        </View>

        {!dismissed ? (
          <View style={{ backgroundColor: colors.aiWash, borderRadius: radius.lg, padding: spacing.lg, gap: spacing.md }}>
            <Text variant="bodySm">{t('home.ai_suggestion')}</Text>
            <View style={{ flexDirection: 'row', gap: spacing.sm, flexWrap: 'wrap' }}>
              <Button label={t('home.ai_accept')} size="sm" icon="calendar" onPress={() => setDismissed(true)} />
              <Button label={t('home.ai_not_now')} size="sm" variant="ghost" onPress={() => setDismissed(true)} />
            </View>
          </View>
        ) : null}

        {isMobile ? (
          // One swipeable row on phones instead of four stacked pills.
          <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginHorizontal: -spacing.xl }} contentContainerStyle={{ gap: spacing.sm, paddingHorizontal: spacing.xl }}>
            {chips}
          </ScrollView>
        ) : (
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm }}>{chips}</View>
        )}
      </View>
    </Gradient>
  );
}
