import { View } from 'react-native';

import { useTheme } from '@/theme';

import { Gradient } from './gradient';
import { Icon, type IconName } from './icon';
import { PressableScale } from './pressable-scale';
import { Text } from './text';

type Props = {
  label: string;
  onPress?: () => void;
  variant?: 'primary' | 'secondary' | 'ghost';
  icon?: IconName;
  size?: 'md' | 'sm';
  accessibilityHint?: string;
};

export function Button({ label, onPress, variant = 'primary', icon, size = 'md', accessibilityHint }: Props) {
  const { colors, radius, spacing, shadow, touchTarget } = useTheme();
  const height = size === 'md' ? 48 : touchTarget;
  const fg = variant === 'primary' ? colors.onPrimary : colors.primary;
  const content = (
    <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: spacing.sm, height, paddingHorizontal: size === 'md' ? spacing.xl : spacing.lg }}>
      {icon ? <Icon name={icon} size={18} tone={fg} /> : null}
      <Text variant="label" weight="semibold" tone={fg}>{label}</Text>
    </View>
  );
  return (
    <PressableScale
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityHint={accessibilityHint}
      onPress={onPress}
      style={{
        borderRadius: radius.button,
        overflow: 'hidden',
        backgroundColor: variant === 'secondary' ? colors.primarySoft : 'transparent',
        boxShadow: variant === 'primary' ? shadow.glow : undefined,
      }}
    >
      {variant === 'primary' ? <Gradient variant="ai">{content}</Gradient> : content}
    </PressableScale>
  );
}
