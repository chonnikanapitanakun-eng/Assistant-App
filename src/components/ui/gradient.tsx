import { LinearGradient } from 'expo-linear-gradient';
import type { PropsWithChildren } from 'react';
import type { StyleProp, ViewStyle } from 'react-native';

import { gradients } from '@/theme';

type Props = PropsWithChildren<{ style?: StyleProp<ViewStyle>; variant?: keyof typeof gradients }>;

/** Veyra brand gradient (135°). Reserve for AI, primary CTA, focus and highlights. */
export function Gradient({ children, style, variant = 'brand' }: Props) {
  const g = gradients[variant];
  return (
    <LinearGradient colors={g.colors} locations={g.locations} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={style}>
      {children}
    </LinearGradient>
  );
}
