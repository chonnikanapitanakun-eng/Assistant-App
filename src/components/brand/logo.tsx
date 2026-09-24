import { Image } from 'expo-image';
import { View } from 'react-native';
import Svg, { Path } from 'react-native-svg';

import { Text } from '@/components/ui/text';
import { useTheme } from '@/theme';

const mark = require('@/assets/brand/veyra-mark.png');
const logo = require('@/assets/brand/veyra-logo.png');

/** App-icon mark: navy rounded square with the ribbon V. Works down to ~24px. */
export function VeyraMark({ size = 32 }: { size?: number }) {
  return <Image source={mark} style={{ width: size, height: size }} contentFit="contain" accessibilityLabel="Veyra" />;
}

/** Full supplied logo (mark + wordmark) — onboarding / splash-sized uses only. */
export function VeyraLogo({ size = 160 }: { size?: number }) {
  return <Image source={logo} style={{ width: size, height: size }} contentFit="contain" accessibilityLabel="Veyra" />;
}

/** Horizontal lock-up for headers and the sidebar. */
export function VeyraLockup({ size = 32 }: { size?: number }) {
  const { spacing } = useTheme();
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.sm + 2 }}>
      <VeyraMark size={size} />
      <Text variant="heading" weight="bold" style={{ letterSpacing: -0.3 }}>Veyra</Text>
    </View>
  );
}

/** Monochrome V glyph for use on top of the brand gradient (e.g. centre nav button). */
export function VGlyph({ size = 24, color = '#FFFFFF' }: { size?: number; color?: string }) {
  return (
    <View aria-hidden pointerEvents="none">
      <Svg width={size} height={size} viewBox="0 0 24 24">
        <Path d="M4.5 6.5c1.6-.6 2.9.1 3.8 1.6l3.1 5.6c.3.5.9.5 1.2 0l3.4-6c.8-1.3 2.2-1.9 3.5-1.3" stroke={color} strokeWidth={3} strokeLinecap="round" strokeLinejoin="round" fill="none" />
      </Svg>
    </View>
  );
}
