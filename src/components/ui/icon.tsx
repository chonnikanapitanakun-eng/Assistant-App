import { Feather } from '@expo/vector-icons';

import { useTheme, type ColorName } from '@/theme';

export type IconName = keyof typeof Feather.glyphMap;

/** Rounded line icons (Feather — the family Lucide is based on). */
export function Icon({ name, size = 20, color = 'primary', tone }: { name: IconName; size?: number; color?: ColorName; tone?: string }) {
  const { colors } = useTheme();
  return <Feather name={name} size={size} color={tone ?? colors[color]} />;
}
