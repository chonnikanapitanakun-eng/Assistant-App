import { View } from 'react-native';

import { useTheme } from '@/theme';

import { Text } from './text';

export function Avatar({ name, size = 40 }: { name: string; size?: number }) {
  const { colors } = useTheme();
  return (
    <View
      accessibilityLabel={name}
      style={{ width: size, height: size, borderRadius: size / 2, backgroundColor: colors.primarySoft, alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: colors.border }}
    >
      <Text variant="label" weight="semibold" color="primary">{name.slice(0, 1).toUpperCase()}</Text>
    </View>
  );
}
