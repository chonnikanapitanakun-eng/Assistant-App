import type { PropsWithChildren } from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { useTheme } from '@/theme';

type Props = PropsWithChildren<{ scroll?: boolean }>;

export function Screen({ children, scroll = true }: Props) {
  const { colors, spacing } = useTheme();
  const insets = useSafeAreaInsets();
  const style = [styles.container, { backgroundColor: colors.background, paddingTop: insets.top + spacing.md, paddingHorizontal: spacing.lg }];
  if (!scroll) return <View style={style}>{children}</View>;
  return (
    <ScrollView style={{ backgroundColor: colors.background }} contentContainerStyle={style}>
      {children}
    </ScrollView>
  );
}

const styles = StyleSheet.create({ container: { flexGrow: 1, gap: 12, paddingBottom: 96 } });
