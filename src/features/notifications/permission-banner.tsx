import { useTranslation } from 'react-i18next';
import { Linking, View } from 'react-native';

import { Button, Icon, Text } from '@/components/ui';
import { useTheme } from '@/theme';

import { useNotificationPermission } from './use-notification-permission';

/** Asks for notification permission in context. Hidden when granted or status is unknown. */
export function NotificationPermissionBanner() {
  const { t } = useTranslation();
  const { colors, radius, spacing } = useTheme();
  const { state, request } = useNotificationPermission();

  if (state === null || state === 'granted') return null;

  const onPress = () => {
    if (state === 'denied') void Linking.openSettings();
    else void request();
  };

  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.md, backgroundColor: colors.aiWash, borderRadius: radius.lg, padding: spacing.lg }}>
      <View style={{ width: 36, height: 36, borderRadius: 12, backgroundColor: colors.surface, alignItems: 'center', justifyContent: 'center' }}>
        <Icon name="bell" size={18} />
      </View>
      <View style={{ flex: 1, gap: spacing.sm }}>
        <Text variant="bodySm">{t('notifications.permission_banner')}</Text>
        <Button size="sm" variant="secondary" label={t(state === 'denied' ? 'notifications.open_settings' : 'notifications.enable')} onPress={onPress} />
      </View>
    </View>
  );
}
