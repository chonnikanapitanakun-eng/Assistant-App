import { useTranslation } from 'react-i18next';
import { View } from 'react-native';

import { PressableScale } from '@/components/ui';
import { useTheme } from '@/theme';

import { SCALE, type ScaleValue } from '../model';

const BAR_BASE = 14;
const BAR_STEP = 8;

/** Five bars, tallest first — tap one to fill up to that level, like a signal or charge meter. */
export function EnergyPicker({ value, onChange }: { value: ScaleValue | null; onChange: (v: ScaleValue) => void }) {
  const { t } = useTranslation();
  const { colors, spacing, radius, touchTarget } = useTheme();
  return (
    <View accessibilityRole="radiogroup" accessibilityLabel={t('review.energy')} style={{ flexDirection: 'row', alignItems: 'flex-end', gap: spacing.xs }}>
      {SCALE.map((v) => {
        const filled = value != null && v <= value;
        return (
          <PressableScale
            key={v}
            accessibilityRole="radio"
            accessibilityState={{ checked: value === v }}
            accessibilityLabel={t(`review.energy_${v}`)}
            onPress={() => onChange(v)}
            style={{ flex: 1, minHeight: touchTarget, alignItems: 'center', justifyContent: 'flex-end' }}
          >
            <View style={{ width: '100%', height: BAR_BASE + v * BAR_STEP, borderRadius: radius.sm, backgroundColor: filled ? colors.primary : colors.surfaceMuted }} />
          </PressableScale>
        );
      })}
    </View>
  );
}
