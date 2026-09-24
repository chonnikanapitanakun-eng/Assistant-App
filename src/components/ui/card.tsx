import type { PropsWithChildren } from 'react';
import { View, type ViewProps } from 'react-native';

import { useTheme } from '@/theme';

export function Card({ children, style, ...rest }: PropsWithChildren<ViewProps>) {
  const { colors, spacing, radius } = useTheme();
  return (
    <View
      {...rest}
      style={[{ backgroundColor: colors.surface, borderRadius: radius.lg, padding: spacing.lg, borderWidth: 1, borderColor: colors.border, gap: spacing.sm }, style]}
    >
      {children}
    </View>
  );
}
