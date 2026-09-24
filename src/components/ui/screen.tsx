import type { PropsWithChildren } from 'react';
import { ScrollView, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { useBreakpoint, useTheme } from '@/theme';

type Props = PropsWithChildren<{
  scroll?: boolean;
  /** Extra bottom space, e.g. for a floating capture bar. */
  bottomInset?: number;
  maxWidth?: number;
}>;

export function Screen({ children, scroll = true, bottomInset = 0, maxWidth = 1200 }: Props) {
  const { colors, spacing } = useTheme();
  const { isDesktop, isMobile } = useBreakpoint();
  const insets = useSafeAreaInsets();
  const pad = isMobile ? spacing.lg + 4 : isDesktop ? spacing.huge : spacing.xxxl;
  const inner = {
    width: '100%' as const,
    maxWidth,
    alignSelf: 'center' as const,
    paddingTop: insets.top + (isDesktop ? spacing.xxxl : spacing.md),
    paddingHorizontal: pad,
    paddingBottom: spacing.xxxl + bottomInset,
    gap: spacing.xxl,
  };
  if (!scroll) return <View style={[{ flex: 1, backgroundColor: colors.background }, inner]}>{children}</View>;
  return (
    <ScrollView style={{ flex: 1, backgroundColor: colors.background }} contentContainerStyle={inner} keyboardShouldPersistTaps="handled">
      {children}
    </ScrollView>
  );
}
