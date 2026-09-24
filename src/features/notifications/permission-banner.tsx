import { useTranslation } from 'react-i18next';
import { Linking, Pressable } from 'react-native';

import { Card, Text } from '@/components/ui';
import { useTheme } from '@/theme';

import { useNotificationPermission } from './use-notification-permission';

/** แจ้งเตือน user ให้เปิด notification permission ถ้ายังไม่ได้ให้ — ซ่อนเองถ้า granted หรือยังไม่รู้สถานะ */
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
    <Card style={{ borderColor: colors.warning }}>
      <Text variant="caption" color="textSecondary">{t('notifications.permission_banner')}</Text>
      <Pressable onPress={onPress} style={{ alignSelf: 'flex-start', marginTop: spacing.xs, paddingVertical: spacing.xs, paddingHorizontal: spacing.md, borderRadius: radius.pill, backgroundColor: colors.primary }}>
        <Text color="onPrimary" variant="caption">{t(state === 'denied' ? 'notifications.open_settings' : 'notifications.enable')}</Text>
      </Pressable>
    </Card>
  );
}
