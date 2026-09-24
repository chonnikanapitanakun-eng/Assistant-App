import { useTheme, type ColorName } from '@/theme';

import { Icon, type IconName } from './icon';
import { PressableScale } from './pressable-scale';

type Props = { icon: IconName; label: string; onPress?: () => void; color?: ColorName; filled?: boolean };

export function IconButton({ icon, label, onPress, color = 'textSecondary', filled }: Props) {
  const { colors, radius, touchTarget } = useTheme();
  return (
    <PressableScale
      accessibilityRole="button"
      accessibilityLabel={label}
      onPress={onPress}
      hitSlop={4}
      style={{
        width: touchTarget,
        height: touchTarget,
        borderRadius: radius.pill,
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: filled ? colors.surfaceMuted : 'transparent',
      }}
    >
      <Icon name={icon} size={20} color={color} />
    </PressableScale>
  );
}
