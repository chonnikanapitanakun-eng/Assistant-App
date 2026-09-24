import { Platform, View } from 'react-native';

import { Icon, PressableScale, Text } from '@/components/ui';
import { useTheme } from '@/theme';

import { parseBlocks, parseInline, type Block } from '../markdown';

const mono = Platform.select({ ios: 'Menlo', android: 'monospace', default: 'ui-monospace, SFMono-Regular, Menlo, monospace' });

function Inline({ text, variant = 'body', done }: { text: string; variant?: 'body' | 'title' | 'heading' | 'subheading'; done?: boolean }) {
  const { colors } = useTheme();
  return (
    <Text variant={variant} color={done ? 'textTertiary' : 'text'} style={[variant === 'body' ? { lineHeight: 26 } : null, done ? { textDecorationLine: 'line-through' } : null]}>
      {parseInline(text).map((s, i) =>
        s.code ? (
          <Text key={i} variant="bodySm" style={{ fontFamily: mono, backgroundColor: colors.surfaceMuted }}>{` ${s.text} `}</Text>
        ) : (
          <Text key={i} variant={variant} weight={s.bold ? 'bold' : undefined} style={s.italic ? { fontStyle: 'italic' } : undefined} color={done ? 'textTertiary' : 'text'}>
            {s.text}
          </Text>
        ),
      )}
    </Text>
  );
}

/** Clean reading view. Checklist items can be ticked in place via `onToggle(line)`. */
export function MarkdownView({ source, onToggle }: { source: string; onToggle?: (line: number) => void }) {
  const { colors, spacing, radius, touchTarget } = useTheme();
  const blocks = parseBlocks(source);

  const render = (b: Block) => {
    switch (b.type) {
      case 'h1':
        return <Inline text={b.text} variant="title" />;
      case 'h2':
        return <View style={{ marginTop: spacing.sm }}><Inline text={b.text} variant="heading" /></View>;
      case 'h3':
        return <Inline text={b.text} variant="subheading" />;
      case 'p':
        return <Inline text={b.text} />;
      case 'bullet':
      case 'number':
        return (
          <View style={{ flexDirection: 'row', gap: spacing.sm, paddingLeft: b.type === 'bullet' ? b.indent * 20 : 0 }}>
            <Text variant="body" color="textSecondary" style={{ width: 18, lineHeight: 26 }}>{b.type === 'bullet' ? '•' : `${b.n}.`}</Text>
            <View style={{ flex: 1 }}><Inline text={b.text} /></View>
          </View>
        );
      case 'check':
        return (
          <PressableScale
            accessibilityRole="checkbox"
            accessibilityState={{ checked: b.checked }}
            accessibilityLabel={b.text}
            disabled={!onToggle}
            onPress={() => onToggle?.(b.line)}
            style={{ flexDirection: 'row', alignItems: 'flex-start', gap: spacing.sm, minHeight: touchTarget - 8 }}
          >
            <View style={{ marginTop: 3, width: 20, height: 20, borderRadius: 6, borderWidth: 2, borderColor: b.checked ? colors.success : colors.borderStrong, backgroundColor: b.checked ? colors.success : 'transparent', alignItems: 'center', justifyContent: 'center' }}>
              {b.checked ? <Icon name="check" size={12} tone={colors.onPrimary} /> : null}
            </View>
            <View style={{ flex: 1 }}><Inline text={b.text} done={b.checked} /></View>
          </PressableScale>
        );
      case 'quote':
        return (
          <View style={{ borderLeftWidth: 3, borderLeftColor: colors.primary, paddingLeft: spacing.md, paddingVertical: 2 }}>
            <Text variant="body" color="textSecondary" style={{ fontStyle: 'italic', lineHeight: 26 }}>{b.text}</Text>
          </View>
        );
      case 'code':
        return (
          <View style={{ backgroundColor: colors.surfaceMuted, borderRadius: radius.md, padding: spacing.md }}>
            <Text variant="bodySm" style={{ fontFamily: mono }}>{b.text}</Text>
          </View>
        );
      case 'hr':
        return <View style={{ height: 1, backgroundColor: colors.border, marginVertical: spacing.sm }} />;
    }
  };

  return (
    <View style={{ gap: spacing.md }}>
      {blocks.map((b) => (
        <View key={`${b.type}:${b.line}`}>{render(b)}</View>
      ))}
    </View>
  );
}
