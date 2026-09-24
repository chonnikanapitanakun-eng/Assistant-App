import { Text as RNText, type TextProps } from 'react-native';

import { useTheme, type ColorName, type FontWeightName, type TypeVariant } from '@/theme';

type Props = TextProps & {
  variant?: TypeVariant;
  color?: ColorName;
  /** Override the variant's weight. */
  weight?: FontWeightName;
  /** Explicit colour, e.g. a tint foreground. Wins over `color`. */
  tone?: string;
  align?: 'left' | 'center' | 'right';
};

export function Text({ variant = 'body', color = 'text', weight, tone, align, style, ...rest }: Props) {
  const { colors, typography, fontFamily } = useTheme();
  const t = typography[variant];
  return (
    <RNText
      {...rest}
      style={[
        {
          color: tone ?? colors[color],
          fontSize: t.fontSize,
          lineHeight: t.lineHeight,
          fontFamily: fontFamily[weight ?? t.weight],
          letterSpacing: 'letterSpacing' in t ? t.letterSpacing : undefined,
          textAlign: align,
          fontVariant: variant === 'number' ? ['tabular-nums'] : undefined,
        },
        style,
      ]}
    />
  );
}
