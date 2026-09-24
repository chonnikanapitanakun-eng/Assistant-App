import { useEffect } from 'react';
import { View } from 'react-native';
import Animated, { useAnimatedStyle, useReducedMotion, useSharedValue, withDelay, withRepeat, withSequence, withTiming } from 'react-native-reanimated';

import { useTheme } from '@/theme';

function Dot({ delay }: { delay: number }) {
  const { colors } = useTheme();
  const reduced = useReducedMotion();
  const v = useSharedValue(0.3);
  useEffect(() => {
    if (reduced) return;
    v.value = withDelay(delay, withRepeat(withSequence(withTiming(1, { duration: 350 }), withTiming(0.3, { duration: 350 })), -1));
  }, [delay, reduced, v]);
  const style = useAnimatedStyle(() => ({ opacity: v.value }));
  return <Animated.View style={[{ width: 7, height: 7, borderRadius: 4, backgroundColor: colors.primary }, style]} />;
}

/** "Veyra is thinking…" dots (static under reduced motion). */
export function Typing() {
  return (
    <View accessibilityLabel="Veyra is typing" style={{ flexDirection: 'row', gap: 5, paddingVertical: 6 }}>
      <Dot delay={0} />
      <Dot delay={150} />
      <Dot delay={300} />
    </View>
  );
}
