import { router } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { View } from 'react-native';

import { Mascot } from '@/components/brand/mascot';
import { Chip, IconButton, Screen, Text } from '@/components/ui';
import { QuickCapture } from '@/features/home/components/quick-capture';
import { user } from '@/features/home/mock';
import { useTheme } from '@/theme';

/** Veyra AI assistant — entry point from the centre nav button. Full chat comes later. */
export default function AssistantScreen() {
  const { t } = useTranslation();
  const { colors, spacing, radius } = useTheme();
  return (
    <Screen scroll={false} maxWidth={720}>
      <View style={{ flexDirection: 'row', justifyContent: 'flex-end' }}>
        <IconButton icon="x" label={t('common.close')} onPress={() => router.back()} filled />
      </View>
      <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', gap: spacing.lg }}>
        <Mascot pose="wave" size={128} />
        <View style={{ backgroundColor: colors.aiWash, borderRadius: radius.lg, borderTopLeftRadius: radius.sm, padding: spacing.lg, maxWidth: 420 }}>
          <Text variant="body">{t('assistant.hello', { name: user.firstName })}</Text>
        </View>
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'center', gap: spacing.sm }}>
          <Chip label={t('home.ai_plan_day')} icon="sun" />
          <Chip label={t('home.ai_overdue')} icon="alert-circle" />
          <Chip label={t('home.ai_expenses')} icon="pie-chart" />
          <Chip label={t('assistant.emails')} icon="mail" />
        </View>
      </View>
      <QuickCapture />
    </Screen>
  );
}
