import { useTranslation } from 'react-i18next';
import { View } from 'react-native';

import { Chip } from '@/components/ui';
import { repeatRules, type RepeatRule } from '@/lib/recurrence';
import { useTheme } from '@/theme';

/** None / daily / weekly / monthly / yearly. */
export function RepeatChips({ value, onChange }: { value: RepeatRule | null; onChange: (v: RepeatRule | null) => void }) {
  const { t } = useTranslation();
  const { spacing } = useTheme();
  return (
    <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm }}>
      <Chip label={t('repeat.none')} selected={!value} onPress={() => onChange(null)} />
      {repeatRules.map((r) => (
        <Chip key={r} icon="repeat" label={t(`repeat.${r}`)} selected={value === r} onPress={() => onChange(r)} />
      ))}
    </View>
  );
}

const TIMED = [0, 10, 30, 60, 1440];
const UNTIMED = [0, 1440];

/** Reminder lead time in minutes; untimed items remind at 09:00 on the day (or the day before). */
export function ReminderChips({ value, onChange, timed }: { value: number | null; onChange: (v: number | null) => void; timed: boolean }) {
  const { t } = useTranslation();
  const { spacing } = useTheme();
  const label = (m: number) => (timed ? t(`remind.before_${m}`) : t(`remind.untimed_${m}`));
  return (
    <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm }}>
      <Chip icon="bell-off" label={t('remind.none')} selected={value === null} onPress={() => onChange(null)} />
      {(timed ? TIMED : UNTIMED).map((m) => (
        <Chip key={m} icon="bell" label={label(m)} selected={value === m} onPress={() => onChange(m)} />
      ))}
    </View>
  );
}
