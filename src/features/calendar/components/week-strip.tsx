import { useTranslation } from 'react-i18next';
import { View } from 'react-native';

import { Icon, PressableScale, Text } from '@/components/ui';
import { isWanPhraDateKey } from '@/lib/thai-lunar';
import { thaiHolidayOnDate } from '@/lib/thai-holidays';
import { useTheme } from '@/theme';

import { fromDateKey } from '../model';

type Props = {
  days: string[];
  selected: string;
  today: string;
  counts: Map<string, { events: number; tasks: number }>;
  onSelect: (date: string) => void;
};

/** Seven day pills. Selected = filled primary, today = primary outline, dot = has items. */
export function WeekStrip({ days, selected, today, counts, onSelect }: Props) {
  const { i18n } = useTranslation();
  const { colors, spacing, radius } = useTheme();
  const locale = i18n.language === 'th' ? 'th-TH' : 'en-GB';
  return (
    <View style={{ flexDirection: 'row', gap: spacing.xs }}>
      {days.map((d) => {
        const date = fromDateKey(d);
        const on = d === selected;
        const isToday = d === today;
        const c = counts.get(d);
        const busy = !!c && c.events + c.tasks > 0;
        const holiday = thaiHolidayOnDate(d);
        const wanPhra = isWanPhraDateKey(d);
        const holidayLabel = holiday ? (locale === 'th-TH' ? holiday.nameTh : holiday.nameEn) : null;
        const a11yLabel = [
          date.toLocaleDateString(locale, { weekday: 'long', day: 'numeric', month: 'long' }),
          holidayLabel,
        ].filter(Boolean).join(', ');
        return (
          <PressableScale
            key={d}
            accessibilityRole="button"
            accessibilityState={{ selected: on }}
            accessibilityLabel={a11yLabel}
            onPress={() => onSelect(d)}
            style={{
              flex: 1,
              minHeight: 64,
              alignItems: 'center',
              justifyContent: 'center',
              gap: 2,
              borderRadius: radius.md,
              backgroundColor: on ? colors.primary : 'transparent',
              borderWidth: isToday && !on ? 1.5 : 0,
              borderColor: colors.primary,
            }}
          >
            <Text variant="caption" tone={on ? colors.onPrimary : colors.textSecondary}>{date.toLocaleDateString(locale, { weekday: 'short' })}</Text>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 2 }}>
              <Text variant="subheading" weight="bold" tone={on ? colors.onPrimary : holiday ? colors.danger : isToday ? colors.primary : colors.text}>{date.getDate()}</Text>
              {wanPhra ? <Icon name="moon" size={9} tone={on ? colors.onPrimary : colors.textTertiary} /> : null}
            </View>
            <View style={{ width: 5, height: 5, borderRadius: 3, backgroundColor: busy ? (on ? colors.onPrimary : colors.primary) : 'transparent' }} />
          </PressableScale>
        );
      })}
    </View>
  );
}
