import { useTranslation } from 'react-i18next';
import { View } from 'react-native';

import { Icon, PressableScale, Text } from '@/components/ui';
import { isWanPhraDateKey } from '@/lib/thai-lunar';
import { thaiHolidayOnDate } from '@/lib/thai-holidays';
import { useTheme } from '@/theme';

import { fromDateKey, monthGrid, weekDays, type CalItem } from '../model';

type Props = {
  date: string;
  selected: string;
  today: string;
  items: CalItem[];
  onSelect: (date: string) => void;
  /** Large cells with event titles (desktop). */
  large?: boolean;
};

export function MonthGrid({ date, selected, today, items, onSelect, large }: Props) {
  const { i18n, t } = useTranslation();
  const { colors, tints, spacing, radius } = useTheme();
  const locale = i18n.language === 'th' ? 'th-TH' : 'en-GB';
  const cells = monthGrid(date);
  const byDay = new Map<string, CalItem[]>();
  for (const i of items) byDay.set(i.date, [...(byDay.get(i.date) ?? []), i]);

  return (
    <View style={{ gap: spacing.xs }}>
      <View style={{ flexDirection: 'row' }}>
        {weekDays(cells[0].date).map((d) => (
          <Text key={d} variant="overline" color="textTertiary" align="center" style={{ flex: 1 }}>
            {fromDateKey(d).toLocaleDateString(locale, { weekday: large ? 'short' : 'narrow' }).toUpperCase()}
          </Text>
        ))}
      </View>
      {Array.from({ length: 6 }, (_, row) => (
        <View key={row} style={{ flexDirection: 'row', gap: large ? spacing.xs : 0 }}>
          {cells.slice(row * 7, row * 7 + 7).map((c) => {
            const on = c.date === selected;
            const isToday = c.date === today;
            const dayItems = (byDay.get(c.date) ?? []).filter((i) => !i.done);
            const events = dayItems.filter((i) => i.kind === 'event');
            const n = fromDateKey(c.date).getDate();
            const holiday = thaiHolidayOnDate(c.date);
            const wanPhra = isWanPhraDateKey(c.date);
            const holidayLabel = holiday ? (locale === 'th-TH' ? holiday.nameTh : holiday.nameEn) : null;
            const a11yLabel = [
              fromDateKey(c.date).toLocaleDateString(locale, { day: 'numeric', month: 'long' }),
              t('calendar.items', { count: dayItems.length }),
              holidayLabel,
              wanPhra ? t('calendar.wan_phra') : null,
            ].filter(Boolean).join(', ');
            return (
              <PressableScale
                key={c.date}
                accessibilityRole="button"
                accessibilityState={{ selected: on }}
                accessibilityLabel={a11yLabel}
                onPress={() => onSelect(c.date)}
                style={{
                  flex: 1,
                  minHeight: large ? 104 : 48,
                  alignItems: large ? 'stretch' : 'center',
                  justifyContent: large ? 'flex-start' : 'center',
                  gap: 3,
                  padding: large ? spacing.sm : 2,
                  borderRadius: radius.md,
                  backgroundColor: large ? (on ? colors.primarySoft : colors.surface) : 'transparent',
                  borderWidth: large ? 1 : 0,
                  borderColor: on ? colors.primary : colors.border,
                  opacity: c.inMonth ? 1 : 0.4,
                }}
              >
                <View style={{ alignSelf: large ? 'flex-start' : 'center', flexDirection: 'row', alignItems: 'center', gap: 3 }}>
                  <View
                    style={{
                      minWidth: 30,
                      height: 30,
                      borderRadius: 15,
                      alignItems: 'center',
                      justifyContent: 'center',
                      backgroundColor: !large && on ? colors.primary : 'transparent',
                      borderWidth: isToday && !(on && !large) ? 1.5 : 0,
                      borderColor: colors.primary,
                    }}
                  >
                    <Text variant="label" weight={isToday || on || holiday ? 'bold' : 'medium'} tone={!large && on ? colors.onPrimary : holiday ? colors.danger : isToday ? colors.primary : colors.text}>{n}</Text>
                  </View>
                  {wanPhra ? <Icon name="moon" size={11} color="textTertiary" /> : null}
                </View>
                {large ? (
                  <>
                    {holidayLabel ? (
                      <Text variant="caption" numberOfLines={1} tone={colors.danger} style={{ fontSize: 11, lineHeight: 16 }}>{holidayLabel}</Text>
                    ) : null}
                    {events.slice(0, 3).map((e) => (
                      <Text key={e.id} variant="caption" numberOfLines={1} tone={tints.meeting.fg} style={{ backgroundColor: tints.meeting.bg, borderRadius: 4, paddingHorizontal: 4, fontSize: 11, lineHeight: 16 }}>
                        {e.start ? `${e.start} ` : ''}{e.title}
                      </Text>
                    ))}
                    {dayItems.length > Math.min(events.length, 3) ? (
                      <Text variant="caption" color="textTertiary" style={{ fontSize: 11, lineHeight: 14 }}>+{dayItems.length - Math.min(events.length, 3)}</Text>
                    ) : null}
                  </>
                ) : (
                  <View style={{ flexDirection: 'row', gap: 2, height: 5 }}>
                    {dayItems.slice(0, 3).map((i) => (
                      <View key={`${i.kind}${i.id}`} style={{ width: 5, height: 5, borderRadius: 3, backgroundColor: i.kind === 'event' ? colors.primary : colors.textTertiary }} />
                    ))}
                  </View>
                )}
              </PressableScale>
            );
          })}
        </View>
      ))}
    </View>
  );
}
