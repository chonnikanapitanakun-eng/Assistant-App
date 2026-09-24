import { Text as RNText, View } from 'react-native';

import { Icon, PressableScale, Text, type IconName } from '@/components/ui';
import { useTheme, type ColorName, type Tint } from '@/theme';

import { highlight } from '../model';

type Props = {
  icon: IconName;
  tint: Tint;
  title: string;
  sub?: string;
  meta?: string;
  metaColor?: ColorName;
  /** Lower-cased query terms to emphasise in the title and sub line. */
  terms: string[];
  accessibilityLabel: string;
  /** Omitted for types without a detail screen yet (contacts). */
  onPress?: () => void;
};

export function ResultRow({ icon, tint, title, sub, meta, metaColor = 'textTertiary', terms, accessibilityLabel, onPress }: Props) {
  const { spacing } = useTheme();
  return (
    <PressableScale
      accessibilityRole={onPress ? 'button' : undefined}
      accessibilityLabel={accessibilityLabel}
      disabled={!onPress}
      onPress={onPress}
      style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.md, minHeight: 56, paddingVertical: spacing.sm }}
    >
      <View style={{ width: 40, height: 40, borderRadius: 12, backgroundColor: tint.bg, alignItems: 'center', justifyContent: 'center' }}>
        <Icon name={icon} size={18} tone={tint.fg} />
      </View>
      <View style={{ flex: 1, minWidth: 0, gap: 2 }}>
        <Text variant="subheading" numberOfLines={1}>
          <Highlighted text={title} terms={terms} />
        </Text>
        {sub ? (
          <Text variant="caption" color="textSecondary" numberOfLines={1}>
            <Highlighted text={sub} terms={terms} />
          </Text>
        ) : null}
      </View>
      {meta ? (
        <Text variant="caption" weight="semibold" color={metaColor} style={{ fontVariant: ['tabular-nums'] }}>
          {meta}
        </Text>
      ) : null}
    </PressableScale>
  );
}

/** Nested spans inside a parent <Text>; matches get the primary colour and a soft wash. */
function Highlighted({ text, terms }: { text: string; terms: string[] }) {
  const { colors, fontFamily } = useTheme();
  return highlight(text, terms).map((p, i) =>
    p.match ? (
      // Raw RN Text so size and line height inherit from the parent row text.
      <RNText key={i} style={{ color: colors.primary, fontFamily: fontFamily.semibold, backgroundColor: colors.primarySoft }}>
        {p.text}
      </RNText>
    ) : (
      p.text
    ),
  );
}
