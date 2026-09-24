import { useTranslation } from 'react-i18next';
import { View } from 'react-native';

import { Icon, PressableScale, Text, type IconName } from '@/components/ui';
import type { CaptureItem, CaptureType } from '@/features/ai/types';
import { formatMoney } from '@/lib/currency';
import { daysFromToday } from '@/lib/date';
import { useTheme, type TintName } from '@/theme';

export const typeStyle: Record<CaptureType, { icon: IconName; tint: TintName }> = {
  event: { icon: 'calendar', tint: 'meeting' },
  task: { icon: 'check-square', tint: 'priorityLow' },
  expense: { icon: 'arrow-up-right', tint: 'priorityHigh' },
  income: { icon: 'arrow-down-left', tint: 'done' },
  note: { icon: 'file-text', tint: 'focus' },
  contact: { icon: 'user', tint: 'personal' },
};

type Props = {
  item: CaptureItem;
  included: boolean;
  onToggle: () => void;
  onSwitchMoneyType?: (type: 'income' | 'expense') => void;
};

/** One thing Veyra detected in the capture text. Tap the check to include / exclude it. */
export function DetectedItem({ item, included, onToggle, onSwitchMoneyType }: Props) {
  const { t, i18n } = useTranslation();
  const { colors, tints, spacing, radius, touchTarget } = useTheme();
  const style = typeStyle[item.type];
  const tint = tints[style.tint];
  const { title, detail } = describe(item, t, i18n.language);
  const typeLabel = t(`capture.type_${item.type}`);

  return (
    <View
      style={{
        flexDirection: 'row',
        alignItems: 'center',
        gap: spacing.md,
        padding: spacing.md,
        borderRadius: radius.lg,
        borderWidth: 1,
        borderColor: included ? colors.border : 'transparent',
        backgroundColor: included ? colors.surface : colors.surfaceMuted,
        opacity: included ? 1 : 0.6,
      }}
    >
      <View style={{ width: 40, height: 40, borderRadius: 12, backgroundColor: tint.bg, alignItems: 'center', justifyContent: 'center' }}>
        <Icon name={style.icon} size={18} tone={tint.fg} />
      </View>

      <View style={{ flex: 1, gap: 2 }}>
        <Text variant="overline" tone={tint.fg}>{typeLabel.toUpperCase()}</Text>
        <Text variant="subheading" numberOfLines={2}>{title}</Text>
        {detail ? <Text variant="caption" color="textSecondary" numberOfLines={2}>{detail}</Text> : null}
        {(item.type === 'expense' || item.type === 'income') && onSwitchMoneyType ? (
          <View style={{ flexDirection: 'row', gap: spacing.xs, marginTop: spacing.xs }}>
            {(['expense', 'income'] as const).map((k) => (
              <PressableScale
                key={k}
                accessibilityRole="radio"
                accessibilityState={{ checked: item.type === k }}
                accessibilityLabel={t(`capture.type_${k}`)}
                onPress={() => onSwitchMoneyType(k)}
                style={{
                  minHeight: 32,
                  paddingHorizontal: spacing.md,
                  justifyContent: 'center',
                  borderRadius: radius.pill,
                  backgroundColor: item.type === k ? tints[typeStyle[k].tint].bg : 'transparent',
                  borderWidth: 1,
                  borderColor: item.type === k ? 'transparent' : colors.border,
                }}
              >
                <Text variant="caption" weight="semibold" tone={item.type === k ? tints[typeStyle[k].tint].fg : colors.textSecondary}>
                  {t(`capture.type_${k}`)}
                </Text>
              </PressableScale>
            ))}
          </View>
        ) : null}
      </View>

      <PressableScale
        accessibilityRole="checkbox"
        accessibilityState={{ checked: included }}
        accessibilityLabel={`${typeLabel}: ${title}`}
        onPress={onToggle}
        style={{ width: touchTarget, height: touchTarget, alignItems: 'center', justifyContent: 'center', marginRight: -spacing.xs }}
      >
        <View
          style={{
            width: 24,
            height: 24,
            borderRadius: 8,
            borderWidth: 2,
            borderColor: included ? colors.primary : colors.borderStrong,
            backgroundColor: included ? colors.primary : 'transparent',
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          {included ? <Icon name="check" size={14} tone={colors.onPrimary} /> : null}
        </View>
      </PressableScale>
    </View>
  );
}

type T = (key: string, opts?: Record<string, unknown>) => string;

function formatWhen(t: T, lang: string, date?: string, time?: string): string {
  if (!date) return time ?? '';
  const diff = daysFromToday(date);
  const day =
    diff === 0
      ? t('capture.today')
      : diff === 1
        ? t('capture.tomorrow')
        : new Date(`${date}T00:00:00`).toLocaleDateString(lang === 'th' ? 'th-TH' : 'en-GB', { weekday: 'short', day: 'numeric', month: 'short' });
  return time ? `${day} · ${time}` : `${day} · ${t('capture.all_day')}`;
}

function describe(item: CaptureItem, t: T, lang: string): { title: string; detail?: string } {
  switch (item.type) {
    case 'event':
    case 'task': {
      const when = formatWhen(t, lang, item.date, item.startTime);
      return { title: item.title, detail: item.contactName ? `${when} · ${t('capture.with', { name: item.contactName })}` : when };
    }
    case 'expense':
    case 'income':
      return { title: formatMoney(item.amount, item.currency, 'en-GB'), detail: item.note };
    case 'note':
      return { title: item.body.split('\n')[0].slice(0, 80) };
    case 'contact':
      return { title: item.name, detail: t('capture.contact_detail') };
  }
}
