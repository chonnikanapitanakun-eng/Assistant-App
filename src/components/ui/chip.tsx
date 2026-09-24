import { useTheme } from '@/theme';

import { Icon, type IconName } from './icon';
import { PressableScale } from './pressable-scale';
import { Text } from './text';

type Props = { label: string; icon?: IconName; selected?: boolean; onPress?: () => void };

/** Pill action / filter. */
export function Chip({ label, icon, selected, onPress }: Props) {
  const { colors, radius, spacing, touchTarget } = useTheme();
  const fg = selected ? colors.onPrimary : colors.primary;
  return (
    <PressableScale
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={{ selected }}
      onPress={onPress}
      style={{
        minHeight: touchTarget,
        flexDirection: 'row',
        alignItems: 'center',
        gap: spacing.xs + 2,
        paddingHorizontal: spacing.lg,
        borderRadius: radius.pill,
        backgroundColor: selected ? colors.primary : colors.primarySoft,
      }}
    >
      {icon ? <Icon name={icon} size={16} tone={fg} /> : null}
      <Text variant="label" tone={fg}>{label}</Text>
    </PressableScale>
  );
}
