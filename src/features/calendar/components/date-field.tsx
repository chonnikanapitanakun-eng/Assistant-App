import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { View } from 'react-native';

import { Icon, IconButton, PressableScale, Text } from '@/components/ui';
import { isValidDate, isValidTime } from '@/features/tasks/model';
import { toDateKey } from '@/lib/date';
import { useTheme } from '@/theme';

import { fromDateKey, fromMinutes, shiftDate, toMinutes } from '../model';
import { MonthGrid } from './month-grid';

type TriggerProps = { icon: 'calendar' | 'clock'; label: string; placeholder: boolean; open: boolean; invalid?: boolean; disabled?: boolean; a11y: string; onPress: () => void };

/** Field-styled button that opens an inline picker. */
function Trigger({ icon, label, placeholder, open, invalid, disabled, a11y, onPress }: TriggerProps) {
  const { colors, tints, spacing, radius } = useTheme();
  return (
    <PressableScale
      accessibilityRole="button"
      accessibilityLabel={a11y}
      accessibilityState={{ expanded: open, disabled }}
      disabled={disabled}
      onPress={onPress}
      style={{
        flex: 1,
        minHeight: 44,
        minWidth: 0,
        flexDirection: 'row',
        alignItems: 'center',
        gap: spacing.sm,
        paddingHorizontal: spacing.md,
        borderRadius: radius.md,
        borderWidth: 1.5,
        borderColor: invalid ? tints.priorityHigh.fg : open ? colors.primary : colors.border,
        backgroundColor: colors.surfaceMuted,
      }}
    >
      <Icon name={icon} size={16} color={placeholder ? 'textTertiary' : 'primary'} />
      <Text variant="body" color={placeholder ? 'textTertiary' : 'text'} numberOfLines={1} style={{ flex: 1 }}>{label}</Text>
      {disabled ? null : <Icon name={open ? 'chevron-up' : 'chevron-down'} size={16} color="textTertiary" />}
    </PressableScale>
  );
}

function usePanelStyle() {
  const { colors, spacing, radius } = useTheme();
  return { gap: spacing.sm, padding: spacing.sm, borderRadius: radius.lg, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.surface };
}

type DateProps = {
  value: string;
  onChange: (date: string) => void;
  invalid?: boolean;
  disabled?: boolean;
};

/** Tap-to-pick date (YYYY-MM-DD). Shows the date in the app language (Buddhist era in Thai). */
export function DateField({ value, onChange, invalid, disabled }: DateProps) {
  const { t, i18n } = useTranslation();
  const { spacing } = useTheme();
  const panel = usePanelStyle();
  const locale = i18n.language === 'th' ? 'th-TH' : 'en-GB';
  const today = toDateKey();
  const valid = isValidDate(value);
  const [open, setOpen] = useState(false);
  const [cursor, setCursor] = useState(valid ? value : today);

  const label = valid
    ? fromDateKey(value).toLocaleDateString(locale, { weekday: 'short', day: 'numeric', month: 'short', year: 'numeric' })
    : t('picker.choose_date');
  const toggle = () => {
    if (!open) setCursor(valid ? value : today);
    setOpen(!open);
  };

  return (
    <View style={{ gap: spacing.sm }}>
      <View style={{ flexDirection: 'row' }}>
        <Trigger icon="calendar" label={label} placeholder={!valid} open={open} invalid={invalid} disabled={disabled} a11y={`${t('task.date')}: ${label}`} onPress={toggle} />
      </View>
      {open ? (
        <View style={panel}>
          <View style={{ flexDirection: 'row', alignItems: 'center' }}>
            <IconButton icon="chevron-left" label={t('picker.prev_month')} onPress={() => setCursor(shiftDate(cursor, 'month', -1))} />
            <Text variant="subheading" align="center" style={{ flex: 1 }}>
              {fromDateKey(cursor).toLocaleDateString(locale, { month: 'long', year: 'numeric' })}
            </Text>
            <IconButton icon="chevron-right" label={t('picker.next_month')} onPress={() => setCursor(shiftDate(cursor, 'month', 1))} />
          </View>
          <MonthGrid
            date={cursor}
            selected={value}
            today={today}
            items={[]}
            onSelect={(d) => {
              onChange(d);
              setOpen(false);
            }}
          />
        </View>
      ) : null}
    </View>
  );
}

const HOURS = Array.from({ length: 24 }, (_, h) => String(h).padStart(2, '0'));
const MINUTES = Array.from({ length: 12 }, (_, i) => String(i * 5).padStart(2, '0'));

type RangeProps = {
  start: string;
  end: string;
  onChangeStart: (v: string) => void;
  onChangeEnd: (v: string) => void;
  invalid?: boolean;
  disabled?: boolean;
  /** Show "No time" (clears both). */
  clearable?: boolean;
};

/**
 * Start–end time picker: two buttons with one shared hour/minute grid below.
 * Picking a start moves the end with it, keeping the duration (1h when there was none).
 */
export function TimeRangeField({ start, end, onChangeStart, onChangeEnd, invalid, disabled, clearable }: RangeProps) {
  const { t } = useTranslation();
  const { colors, spacing, radius } = useTheme();
  const panel = usePanelStyle();
  const [active, setActive] = useState<'start' | 'end' | null>(null);

  const value = active === 'end' ? end : start;
  const [hh, mm] = isValidTime(value) ? value.split(':') : [null, null];

  const set = (next: string, done: boolean) => {
    if (active === 'start') {
      // Keep the current duration (default 1h) so moving the start drags the end along.
      const length = isValidTime(start) && isValidTime(end) && end > start ? toMinutes(end) - toMinutes(start) : 60;
      onChangeStart(next);
      onChangeEnd(fromMinutes(Math.min(toMinutes(next) + length, 23 * 60 + 59)));
    } else onChangeEnd(next);
    if (done) setActive(null);
  };

  const cell = (label: string, on: boolean, onPress: () => void, a11y: string) => (
    <PressableScale
      key={label}
      accessibilityRole="button"
      accessibilityLabel={a11y}
      accessibilityState={{ selected: on }}
      onPress={onPress}
      style={{ width: '16.66%', minHeight: 44, padding: 2 }}
    >
      <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', borderRadius: radius.md, backgroundColor: on ? colors.primary : 'transparent' }}>
        <Text variant="label" weight={on ? 'bold' : 'medium'} tone={on ? colors.onPrimary : colors.text} style={{ fontVariant: ['tabular-nums'] }}>{label}</Text>
      </View>
    </PressableScale>
  );

  return (
    <View style={{ gap: spacing.sm }}>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.sm }}>
        <Trigger icon="clock" label={start || t('picker.start')} placeholder={!start} open={active === 'start'} invalid={invalid} disabled={disabled} a11y={`${t('task.start_time')}: ${start || '-'}`} onPress={() => setActive(active === 'start' ? null : 'start')} />
        <Text color="textTertiary">–</Text>
        <Trigger icon="clock" label={end || t('picker.end')} placeholder={!end} open={active === 'end'} invalid={invalid} disabled={disabled} a11y={`${t('task.end_time')}: ${end || '-'}`} onPress={() => setActive(active === 'end' ? null : 'end')} />
      </View>
      {active ? (
        <View style={panel}>
          <Text variant="overline" color="textSecondary">{t('picker.hour')}</Text>
          <View style={{ flexDirection: 'row', flexWrap: 'wrap' }}>
            {HOURS.map((h) => cell(h, h === hh, () => set(`${h}:${mm ?? '00'}`, false), `${t('picker.hour')} ${h}`))}
          </View>
          <Text variant="overline" color="textSecondary">{t('picker.minute')}</Text>
          <View style={{ flexDirection: 'row', flexWrap: 'wrap' }}>
            {MINUTES.map((m) => cell(`:${m}`, m === mm, () => set(`${hh ?? (active === 'end' && isValidTime(start) ? start.slice(0, 2) : '09')}:${m}`, true), `${t('picker.minute')} ${m}`))}
          </View>
          <View style={{ flexDirection: 'row', justifyContent: 'flex-end', gap: spacing.sm }}>
            {clearable && (start || end) ? (
              <PressableScale
                accessibilityRole="button"
                onPress={() => {
                  onChangeStart('');
                  onChangeEnd('');
                  setActive(null);
                }}
                style={{ minHeight: 44, justifyContent: 'center', paddingHorizontal: spacing.md }}
              >
                <Text variant="label" color="textSecondary">{t('picker.no_time')}</Text>
              </PressableScale>
            ) : null}
            <PressableScale accessibilityRole="button" onPress={() => setActive(null)} style={{ minHeight: 44, justifyContent: 'center', paddingHorizontal: spacing.md }}>
              <Text variant="label" color="primary">{t('common.done')}</Text>
            </PressableScale>
          </View>
        </View>
      ) : null}
    </View>
  );
}
