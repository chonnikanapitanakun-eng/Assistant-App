import type { ReactNode } from 'react';
import { View } from 'react-native';
import Svg, { Circle, Defs, LinearGradient, Stop } from 'react-native-svg';

import { gradients } from '@/theme';

/** Large circular progress ring with the brand gradient stroke. */
export function FocusRing({ size, progress, children, track = 'rgba(255,255,255,0.10)' }: { size: number; progress: number; children?: ReactNode; track?: string }) {
  const stroke = Math.max(10, Math.round(size * 0.045));
  const r = (size - stroke) / 2;
  const c = 2 * Math.PI * r;
  const g = gradients.brand;
  return (
    <View style={{ width: size, height: size, alignItems: 'center', justifyContent: 'center' }}>
      <Svg width={size} height={size} style={{ position: 'absolute', transform: [{ rotate: '-90deg' }] }}>
        <Defs>
          <LinearGradient id="focusRing" x1="0" y1="0" x2="1" y2="1">
            {g.colors.map((col, i) => (
              <Stop key={col} offset={g.locations[i]} stopColor={col} />
            ))}
          </LinearGradient>
        </Defs>
        <Circle cx={size / 2} cy={size / 2} r={r} stroke={track} strokeWidth={stroke} fill="none" />
        <Circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          stroke="url(#focusRing)"
          strokeWidth={stroke}
          strokeLinecap="round"
          fill="none"
          strokeDasharray={`${c} ${c}`}
          strokeDashoffset={c * (1 - Math.min(Math.max(progress, 0), 1))}
        />
      </Svg>
      {children}
    </View>
  );
}
