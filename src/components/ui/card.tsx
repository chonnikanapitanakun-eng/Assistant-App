import type { PropsWithChildren } from 'react';
import { View, type ViewProps } from 'react-native';

import { useTheme } from '@/theme';

type Props = PropsWithChildren<ViewProps> & {
  variant?: 'default' | 'muted' | 'outline';
  padding?: 'none' | 'md' | 'lg';
};

export function Card({ children, style, variant = 'default', padding = 'lg', ...rest }: Props) {
  const { colors, spacing, radius, shadow } = useTheme();
  const bg = variant === 'muted' ? colors.surfaceMuted : variant === 'outline' ? 'transparent' : colors.surface;
  return (
    <View
      {...rest}
      style={[
        {
          backgroundColor: bg,
          borderRadius: radius.card,
          padding: padding === 'none' ? 0 : padding === 'md' ? spacing.md : spacing.xl,
          borderWidth: 1,
          borderColor: colors.border,
          boxShadow: variant === 'default' ? shadow.sm : undefined,
          gap: spacing.md,
        },
        style,
      ]}
    >
      {children}
    </View>
  );
}
