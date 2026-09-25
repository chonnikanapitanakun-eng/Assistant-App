import { useTranslation } from 'react-i18next';
import { View } from 'react-native';

import { Text } from '@/components/ui';
import { useTheme } from '@/theme';

import { isScaleValue } from '../model';

import { MOOD_EMOJI } from './mood-picker';

const H = 64;

/** Energy as a bar (mood as the emoji above it), oldest day first, today last. */
export function WeekTrend({ days }: { days: { date: string; mood: number | null; energy: number | null }[] }) {
  const { t, i18n } = useTranslation();
  const { colors } = useTheme();
  const locale = i18n.language === 'th' ? 'th-TH' : 'en-GB';
  return (
    <View accessibilityRole="summary" accessibilityLabel={t('review.week_chart_label')} style={{ flexDirection: 'row', alignItems: 'flex-end', gap: 6 }}>
      {days.map((d, i) => {
        const today = i === days.length - 1;
        const h = d.energy ? Math.max(6, (d.energy / 5) * H) : 0;
        const label = new Date(`${d.date}T00:00:00`).toLocaleDateString(locale, { weekday: 'narrow' });
        return (
          <View key={d.date} style={{ flex: 1, alignItems: 'center', gap: 6 }}>
            <Text style={{ fontSize: 18, height: 22 }}>{d.mood && isScaleValue(d.mood) ? MOOD_EMOJI[d.mood] : ''}</Text>
            <View style={{ height: H, justifyContent: 'flex-end', width: '100%', alignItems: 'center' }}>
              <View style={{ width: 18, height: h, backgroundColor: colors.primary, opacity: today ? 1 : 0.65, borderTopLeftRadius: 4, borderTopRightRadius: 4 }} />
            </View>
            <View style={{ height: 1, alignSelf: 'stretch', backgroundColor: colors.border }} />
            <Text variant="caption" color={today ? 'text' : 'textSecondary'} weight={today ? 'bold' : 'regular'}>{label}</Text>
          </View>
        );
      })}
    </View>
  );
}
