import { Image } from 'expo-image';

/**
 * Veyra mascot. Use sparingly: onboarding, empty/success states, AI, loading, recovery.
 * Poses are cut from assets/brand/mascot/source/ (see the pose sheet there).
 */
const sources = {
  wave: require('@/assets/brand/mascot/wave.png'),
  happy: require('@/assets/brand/mascot/happy.png'),
  celebrate: require('@/assets/brand/mascot/celebrate.png'),
  thinking: require('@/assets/brand/mascot/thinking.png'),
  idea: require('@/assets/brand/mascot/idea.png'),
  success: require('@/assets/brand/mascot/success.png'),
  search: require('@/assets/brand/mascot/search.png'),
  working: require('@/assets/brand/mascot/working.png'),
  sleep: require('@/assets/brand/mascot/sleep.png'),
  calm: require('@/assets/brand/mascot/calm.png'),
  oops: require('@/assets/brand/mascot/oops.png'),
  focus: require('@/assets/brand/mascot/focus.png'),
} as const;

export type MascotPose = keyof typeof sources;

export function Mascot({ pose = 'wave', size = 96 }: { pose?: MascotPose; size?: number }) {
  return (
    <Image
      source={sources[pose]}
      style={{ width: size, height: size }}
      contentFit="contain"
      transition={200}
      accessibilityLabel="Veyra assistant"
    />
  );
}
