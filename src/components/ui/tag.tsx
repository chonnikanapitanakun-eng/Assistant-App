import { View } from 'react-native';

import { useTheme, type TintName } from '@/theme';

import { Icon, type IconName } from './icon';
import { Text } from './text';

/** Small soft-tinted label. Always carries text, so meaning never relies on colour alone. */
export function Tag({ label, tint, icon }: { label: string; tint: TintName; icon?: IconName }) {
  const { tints, radius, spacing } = useTheme();
  const t = tints[tint];
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4, alignSelf: 'flex-start', backgroundColor: t.bg, borderRadius: radius.pill, paddingHorizontal: spacing.sm, paddingVertical: 2 }}>
      {icon ? <Icon name={icon} size={12} tone={t.fg} /> : null}
      <Text variant="overline" tone={t.fg} style={{ letterSpacing: 0.2 }}>{label}</Text>
    </View>
  );
}
