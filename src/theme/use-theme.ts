import { useColorScheme, useWindowDimensions } from 'react-native';

import {
  breakpoints,
  fontFamily,
  gradients,
  motion,
  radius,
  shadows,
  spacing,
  themes,
  touchTarget,
  typography,
} from './tokens';

export function useTheme() {
  const isDark = useColorScheme() === 'dark';
  const theme = isDark ? themes.dark : themes.light;
  return {
    colors: theme.colors,
    tints: theme.tints,
    shadow: isDark ? shadows.dark : shadows.light,
    spacing,
    radius,
    typography,
    fontFamily,
    gradients,
    motion,
    touchTarget,
    isDark,
  } as const;
}

export type Breakpoint = 'mobile' | 'tablet' | 'desktop';

export function useBreakpoint() {
  const { width } = useWindowDimensions();
  const bp: Breakpoint = width >= breakpoints.desktop ? 'desktop' : width >= breakpoints.tablet ? 'tablet' : 'mobile';
  return { bp, width, isDesktop: bp === 'desktop', isMobile: bp === 'mobile' } as const;
}
