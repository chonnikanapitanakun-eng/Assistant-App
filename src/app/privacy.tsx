import { router } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { View } from 'react-native';

import { Button, Card, IconButton, Screen, Text } from '@/components/ui';
import { PRIVACY_CONTACT_EMAIL, PRIVACY_UPDATED_AT } from '@/features/privacy';
import { useTheme } from '@/theme';

type Section = { title: string; body: string };

/**
 * Privacy policy (PDPA, P4-07). The text lives in i18n (`privacy.sections`) so it is bilingual
 * like the rest of the app; on web this route doubles as the public policy URL for the stores.
 */
export default function PrivacyScreen() {
  const { t, i18n } = useTranslation();
  const { spacing } = useTheme();
  const back = () => (router.canGoBack() ? router.back() : router.replace('/settings'));
  const sections = t('privacy.sections', { returnObjects: true }) as Section[];
  const locale = i18n.language === 'th' ? 'th-TH' : 'en-GB';
  const updated = new Date(PRIVACY_UPDATED_AT).toLocaleDateString(locale, { day: 'numeric', month: 'long', year: 'numeric' });

  return (
    <Screen maxWidth={720}>
      <View style={{ gap: spacing.sm }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.sm, marginLeft: -spacing.sm }}>
          <IconButton icon="chevron-left" label={t('common.back')} onPress={back} />
          <Text variant="title" accessibilityRole="header">{t('privacy.policy')}</Text>
        </View>
        <Text variant="caption" color="textTertiary">{t('privacy.updated', { date: updated })}</Text>
        <Text color="textSecondary">{t('privacy.intro')}</Text>
      </View>

      {sections.map((s) => (
        <Card key={s.title} padding="md" style={{ gap: spacing.sm }}>
          <Text variant="heading" accessibilityRole="header">{s.title}</Text>
          <Text variant="bodySm" color="textSecondary">{s.body.replace(/\{\{email\}\}/g, PRIVACY_CONTACT_EMAIL)}</Text>
        </Card>
      ))}

      <View style={{ gap: spacing.md, alignItems: 'flex-start' }}>
        <Text variant="caption" color="textTertiary">{t('privacy.contact_row', { email: PRIVACY_CONTACT_EMAIL })}</Text>
        <Button variant="secondary" icon="settings" label={t('privacy.manage')} onPress={() => router.replace('/settings')} />
      </View>
    </Screen>
  );
}
