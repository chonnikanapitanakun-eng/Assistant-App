import { useTranslation } from 'react-i18next';
import { View } from 'react-native';

import { PressableScale, Text } from '@/components/ui';
import { useTheme } from '@/theme';

import { SCALE, type ScaleValue } from '../model';

export const MOOD_EMOJI: Record<ScaleValue, string> = { 1: '😞', 2: '🙁', 3: '😐', 4: '🙂', 5: '😄' };

export function MoodPicker({ value, onChange }: { value: ScaleValue | null; onChange: (v: ScaleValue) => void }) {
  const { t } = useTranslation();
  const { colors, spacing, radius, touchTarget } = useTheme();
  return (
    <View accessibilityRole="radiogroup" accessibilityLabel={t('review.mood')} style={{ flexDirection: 'row', gap: spacing.xs }}>
      {SCALE.map((v) => {
        const selected = value === v;
        return (
          <PressableScale
            key={v}
            accessibilityRole="radio"
            accessibilityState={{ checked: selected }}
            accessibilityLabel={t(`review.mood_${v}`)}
            onPress={() => onChange(v)}
            style={{
              flex: 1,
              minHeight: touchTarget + 8,
              alignItems: 'center',
              justifyContent: 'center',
              borderRadius: radius.lg,
              backgroundColor: selected ? colors.primarySoft : 'transparent',
              borderWidth: 1.5,
              borderColor: selected ? colors.primary : colors.border,
            }}
          >
            <Text style={{ fontSize: 24 }}>{MOOD_EMOJI[v]}</Text>
          </PressableScale>
        );
      })}
    </View>
  );
}
