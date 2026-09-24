import { Image } from 'expo-image';
import { View } from 'react-native';

import { useTheme } from '@/theme';

import { VeyraMark } from './logo';

export type MascotPose = 'wave' | 'happy' | 'thinking' | 'working' | 'celebrate' | 'calm';

/**
 * Veyra mascot. Use sparingly: onboarding, empty/success states, AI, loading, recovery.
 *
 * TODO(brand): drop the supplied mascot PNGs into assets/brand/mascot/<pose>.png and
 * register them in `sources`. Until then this renders the brand mark on a soft halo.
 */
const sources: Partial<Record<MascotPose, number>> = {};

export function Mascot({ pose = 'wave', size = 96 }: { pose?: MascotPose; size?: number }) {
  const { colors } = useTheme();
  const src = sources[pose];
  if (src) {
    return <Image source={src} style={{ width: size, height: size }} contentFit="contain" accessibilityLabel="Veyra assistant" />;
  }
  return (
    <View
      accessibilityLabel="Veyra assistant"
      style={{ width: size, height: size, borderRadius: size / 2, backgroundColor: colors.aiWash, alignItems: 'center', justifyContent: 'center' }}
    >
      <VeyraMark size={size * 0.56} />
    </View>
  );
}
