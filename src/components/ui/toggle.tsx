import { Switch } from 'react-native';

import { useTheme } from '@/theme';

type Props = { value: boolean; onValueChange: (v: boolean) => void; label: string; disabled?: boolean; tone?: 'primary' | 'success' };

/** Branded switch. Pins the thumb to white on every platform (react-native-web defaults to teal). */
export function Toggle({ value, onValueChange, label, disabled, tone = 'primary' }: Props) {
  const { colors } = useTheme();
  const webThumb = { activeThumbColor: colors.onPrimary } as object;
  return (
    <Switch
      value={value}
      onValueChange={onValueChange}
      disabled={disabled}
      accessibilityLabel={label}
      thumbColor={colors.onPrimary}
      trackColor={{ true: tone === 'success' ? colors.success : colors.primary, false: colors.borderStrong }}
      ios_backgroundColor={colors.borderStrong}
      {...webThumb}
    />
  );
}
