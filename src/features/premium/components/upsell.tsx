import { router } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { View } from 'react-native';

import { Button, Icon, Text } from '@/components/ui';
import { supabaseEnabled } from '@/lib/supabase';
import { useTheme } from '@/theme';

import { useAiAllowed } from '../gate';
import { usePremiumStore, usePro } from '../store';

type Feature = 'capture' | 'assistant' | 'slip' | 'sync';

/**
 * One-line "this is Veyra Pro" note under an AI feature, with a way to the plan screen.
 * Hidden while AI is allowed, and in builds without the cloud project (nothing to sell there).
 */
export function AiUpsell({ feature }: { feature: Feature }) {
  const { t } = useTranslation();
  const { colors, spacing, radius } = useTheme();
  const aiAllowed = useAiAllowed();
  const pro = usePro();
  // Sync only needs Pro; the AI cap doesn't apply to it.
  const quota = usePremiumStore((s) => s.blocked === 'quota_exceeded') && feature !== 'sync';
  if (!supabaseEnabled || (feature === 'sync' ? pro : aiAllowed)) return null;

  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.md, backgroundColor: colors.aiWash, borderRadius: radius.md, padding: spacing.md }}>
      <Icon name={quota ? 'pie-chart' : 'star'} size={18} />
      <Text variant="caption" color="textSecondary" style={{ flex: 1 }}>
        {quota ? t('premium.upsell_quota') : t(`premium.upsell_${feature}`)}
      </Text>
      <Button size="sm" variant="secondary" label={quota ? t('premium.see_plan') : t('premium.upgrade')} onPress={() => router.push('/premium')} />
    </View>
  );
}
