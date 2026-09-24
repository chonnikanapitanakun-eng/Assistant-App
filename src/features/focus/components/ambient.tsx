import { useEffect } from 'react';
import { StyleSheet, View } from 'react-native';
import Animated, { Easing, useAnimatedStyle, useReducedMotion, useSharedValue, withRepeat, withTiming } from 'react-native-reanimated';

import { Gradient } from '@/components/ui';

/** Slow drifting gradient glow behind the timer. Still when reduced motion is on. */
export function Ambient({ active }: { active: boolean }) {
  const reduced = useReducedMotion();
  const t = useSharedValue(0);
  useEffect(() => {
    if (reduced) return;
    t.value = withRepeat(withTiming(1, { duration: 24_000, easing: Easing.inOut(Easing.sin) }), -1, true);
  }, [reduced, t]);

  const a = useAnimatedStyle(() => ({ transform: [{ translateX: -60 + t.value * 120 }, { translateY: -40 + t.value * 60 }, { rotate: `${t.value * 40}deg` }] }));
  const b = useAnimatedStyle(() => ({ transform: [{ translateX: 50 - t.value * 100 }, { translateY: 30 - t.value * 80 }] }));

  return (
    <View pointerEvents="none" style={[StyleSheet.absoluteFill, { overflow: 'hidden', alignItems: 'center', justifyContent: 'center' }]}>
      <Animated.View style={[{ position: 'absolute', width: 520, height: 520, borderRadius: 260, opacity: active ? 0.32 : 0.18 }, a]}>
        <Gradient variant="brand" style={{ flex: 1, borderRadius: 260 }} />
      </Animated.View>
      <Animated.View style={[{ position: 'absolute', width: 380, height: 380, borderRadius: 190, opacity: active ? 0.22 : 0.12, top: '55%' }, b]}>
        <Gradient variant="ai" style={{ flex: 1, borderRadius: 190 }} />
      </Animated.View>
      {/* Veil keeps text contrast high over the glow. */}
      <View style={[StyleSheet.absoluteFill, { backgroundColor: 'rgba(11,16,32,0.55)' }]} />
    </View>
  );
}
