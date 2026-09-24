import { Text as RNText, type TextProps } from 'react-native';

import { useTheme, type ColorName } from '@/theme';

type Variant = 'title' | 'heading' | 'body' | 'caption';

const sizes: Record<Variant, { size: keyof ReturnType<typeof useTheme>['fontSize']; weight: '400' | '600' | '700' }> = {
  title: { size: 'xl', weight: '700' },
  heading: { size: 'lg', weight: '600' },
  body: { size: 'md', weight: '400' },
  caption: { size: 'sm', weight: '400' },
};

export function Text({ variant = 'body', color = 'text', style, ...rest }: TextProps & { variant?: Variant; color?: ColorName }) {
  const { colors, fontSize } = useTheme();
  const v = sizes[variant];
  return <RNText {...rest} style={[{ color: colors[color], fontSize: fontSize[v.size], fontWeight: v.weight }, style]} />;
}
