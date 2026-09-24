import { useTranslation } from 'react-i18next';
import { View } from 'react-native';

import { Text } from '@/components/ui';

/**
 * Minutes focused per day — one series, one hue. Columns ≤ 24px from a shared
 * baseline, 4px rounded cap, value on the cap in text colour (never the mark colour).
 */
export function WeekChart({ days, fg, fg2, mark, track }: { days: { date: string; minutes: number }[]; fg: string; fg2: string; mark: string; track: string }) {
  const { i18n, t } = useTranslation();
  const locale = i18n.language === 'th' ? 'th-TH' : 'en-GB';
  const max = Math.max(...days.map((d) => d.minutes), 25);
  const H = 120;
  return (
    <View accessibilityRole="summary" accessibilityLabel={t('focus.week_chart_label')} style={{ flexDirection: 'row', alignItems: 'flex-end', gap: 8 }}>
      {days.map((d, i) => {
        const today = i === days.length - 1;
        const h = d.minutes ? Math.max(4, (d.minutes / max) * H) : 0;
        const label = new Date(`${d.date}T00:00:00`).toLocaleDateString(locale, { weekday: 'narrow' });
        return (
          <View key={d.date} accessible accessibilityLabel={`${new Date(`${d.date}T00:00:00`).toLocaleDateString(locale, { weekday: 'long' })}: ${t('focus.minutes', { count: d.minutes })}`} style={{ flex: 1, alignItems: 'center', gap: 6 }}>
            <Text variant="caption" tone={d.minutes ? fg : fg2} style={{ fontSize: 11, fontVariant: ['tabular-nums'] }}>{d.minutes || ''}</Text>
            <View style={{ height: H, justifyContent: 'flex-end', width: '100%', alignItems: 'center' }}>
              <View style={{ width: 22, height: h, backgroundColor: mark, borderTopLeftRadius: 4, borderTopRightRadius: 4 }} />
            </View>
            <View style={{ height: 1, alignSelf: 'stretch', backgroundColor: track }} />
            <Text variant="caption" tone={today ? fg : fg2} weight={today ? 'bold' : 'regular'}>{label}</Text>
          </View>
        );
      })}
    </View>
  );
}
