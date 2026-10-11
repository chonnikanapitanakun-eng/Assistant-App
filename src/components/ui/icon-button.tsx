import { useTheme, type ColorName } from '@/theme';

import { Icon, type IconName } from './icon';
import { PressableScale } from './pressable-scale';

type Props = { icon: IconName; label: string; onPress?: () => void; color?: ColorName; filled?: boolean; disabled?: boolean };

export function IconButton({ icon, label, onPress, color = 'textSecondary', filled, disabled }: Props) {
  const { colors, radius, touchTarget } = useTheme();
  return (
    <PressableScale
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={disabled ? { disabled } : undefined}
      disabled={disabled}
      onPress={onPress}
      hitSlop={4}
      style={{
        width: touchTarget,
        height: touchTarget,
        borderRadius: radius.pill,
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: filled ? colors.surfaceMuted : 'transparent',
        opacity: disabled ? 0.35 : 1,
      }}
    >
      <Icon name={icon} size={20} color={color} />
    </PressableScale>
  );
}
