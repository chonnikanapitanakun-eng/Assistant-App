import type { ReactNode } from 'react';
import { View, type TextStyle } from 'react-native';

import { useTheme } from '@/theme';

import { Icon, type IconName } from './icon';
import { Text } from './text';

/** Labelled form section used by every sheet. */
export function Field({ label, icon, children }: { label: string; icon: IconName; children: ReactNode }) {
  const { spacing } = useTheme();
  return (
    <View style={{ gap: spacing.sm }}>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.sm }}>
        <Icon name={icon} size={14} color="textSecondary" />
        <Text variant="overline" color="textSecondary">{label.toUpperCase()}</Text>
      </View>
      {children}
    </View>
  );
}

export function FieldError({ message }: { message: string | null | undefined }) {
  const { tints } = useTheme();
  if (!message) return null;
  return (
    <Text variant="caption" tone={tints.priorityHigh.fg} accessibilityLiveRegion="polite">
      {message}
    </Text>
  );
}

/** Text input style; pass `error` (and `showErrors`) to outline invalid fields. */
export function useInputStyle() {
  const { colors, tints, spacing, radius, typography, fontFamily } = useTheme();
  return (error?: string | null, showErrors?: boolean): TextStyle => ({
    backgroundColor: colors.surfaceMuted,
    color: colors.text,
    borderRadius: radius.md,
    paddingHorizontal: spacing.md,
    minHeight: 44,
    minWidth: 0,
    borderWidth: 1.5,
    borderColor: showErrors && error ? tints.priorityHigh.fg : colors.border,
    fontSize: typography.body.fontSize,
    fontFamily: fontFamily.regular,
  });
}
