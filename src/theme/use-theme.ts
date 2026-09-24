import { useColorScheme } from 'react-native';

import { fontSize, radius, spacing, themes, type ThemeColors } from './tokens';

export function useTheme() {
  const scheme = useColorScheme();
  const colors: ThemeColors = scheme === 'dark' ? themes.dark : themes.light;
  return { colors, spacing, radius, fontSize, isDark: scheme === 'dark' } as const;
}
