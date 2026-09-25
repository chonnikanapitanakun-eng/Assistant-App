import { router, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ScrollView, TextInput, View } from 'react-native';

import { Mascot } from '@/components/brand/mascot';
import { Button, Chip, Field, FieldError, IconButton, Sheet, Text, Toggle, useInputStyle, type IconName } from '@/components/ui';
import type { Routine } from '@/db';
import { dayName, periodIcon } from '@/features/routines/labels';
import { PERIODS, ruleDays, toRule, WEEK_ORDER, WEEKDAYS, WEEKENDS, type Period } from '@/features/routines/model';
import { createRoutine, deleteRoutine, updateRoutine, useRoutine } from '@/features/routines/queries';
import { isValidTime } from '@/features/tasks/model';
import { useAreas } from '@/features/tasks/queries';
import { useAsyncAction } from '@/lib/use-async-action';
import { useConfirm } from '@/lib/use-confirm';
import { useTheme } from '@/theme';

const energies: { key: 'low' | 'med' | 'high'; icon: IconName }[] = [
  { key: 'low', icon: 'battery' },
  { key: 'med', icon: 'battery-charging' },
  { key: 'high', icon: 'zap' },
];
const presets = [
  { key: 'daily', days: [0, 1, 2, 3, 4, 5, 6] },
  { key: 'weekdays', days: WEEKDAYS },
  { key: 'weekends', days: WEEKENDS },
];
const same = (a: number[], b: number[]) => a.length === b.length && a.every((d) => b.includes(d));

export default function RoutineScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const isNew = id === 'new';
  const { routine, loaded } = useRoutine(isNew ? '' : id);
  const close = () => (router.canGoBack() ? router.back() : router.replace('/routines'));
  if (!isNew && !routine) return loaded ? <NotFound onClose={close} /> : null;
  return <RoutineForm key={routine?.id ?? 'new'} existing={routine} onClose={close} />;
}

function RoutineForm({ existing, onClose }: { existing?: Routine; onClose: () => void }) {
  const { t, i18n } = useTranslation();
  const { colors, spacing, typography, fontFamily } = useTheme();
  const input = useInputStyle();
  const areas = useAreas().filter((a) => a.parentId);
  const { armed, confirm } = useConfirm();
  const { busy, failed, run } = useAsyncAction();
  const th = i18n.language === 'th';
  const tpl = existing?.template ?? {};

  const [title, setTitle] = useState(existing?.title ?? '');
  const [period, setPeriod] = useState<Period | null>(existing?.period ?? 'morning');
  const [days, setDays] = useState<number[]>(existing ? ruleDays(existing.rule) : [0, 1, 2, 3, 4, 5, 6]);
  const [startTime, setStartTime] = useState(tpl.startTime ?? '');
  const [endTime, setEndTime] = useState(tpl.endTime ?? '');
  const [energy, setEnergy] = useState(tpl.energy ?? null);
  const [areaId, setAreaId] = useState(existing?.areaId ?? null);
  const [steps, setSteps] = useState<string[]>(tpl.steps ?? []);
  const [newStep, setNewStep] = useState('');
  const [active, setActive] = useState(existing?.active ?? true);
  const [showErrors, setShowErrors] = useState(false);

  const errors = {
    title: !title.trim() ? t('task.title_required') : null,
    days: days.length === 0 ? t('routines.days_required') : null,
    startTime: startTime && !isValidTime(startTime) ? t('tasks.invalid_time') : null,
    endTime: endTime && (!isValidTime(endTime) || !isValidTime(startTime) || endTime <= startTime) ? t('tasks.invalid_end') : null,
  };

  const toggleDay = (d: number) => setDays((prev) => (prev.includes(d) ? prev.filter((x) => x !== d) : [...prev, d]));
  const addStep = () => {
    const text = newStep.trim();
    if (!text) return;
    setSteps((prev) => [...prev, text]);
    setNewStep('');
  };

  const save = () => {
    if (Object.values(errors).some(Boolean)) {
      setShowErrors(true);
      return;
    }
    const pending = newStep.trim();
    const values = {
      title: title.trim(),
      rule: toRule(days),
      period,
      areaId,
      active,
      template: { startTime: startTime || null, endTime: endTime || null, energy, steps: pending ? [...steps, pending] : steps },
    };
    void run(async () => {
      if (existing) await updateRoutine(existing.id, values);
      else await createRoutine(values);
      onClose();
    });
  };

  return (
    <Sheet
      wide="side"
      onClose={onClose}
      title={existing ? t('routines.edit') : t('routines.add')}
      footer={
        <View style={{ gap: spacing.sm }}>
          <FieldError message={failed ? t('common.save_failed') : null} />
          <Button fullWidth icon="check" label={t('common.save')} disabled={busy} onPress={save} />
          {existing ? (
            <Button
              fullWidth
              variant="ghost"
              icon="trash-2"
              label={armed ? t('tasks.delete_confirm') : t('common.delete')}
              accessibilityHint={t('routines.delete_hint')}
              disabled={busy}
              onPress={() => confirm(() => void run(async () => { await deleteRoutine(existing.id); onClose(); }))}
            />
          ) : null}
        </View>
      }
    >
      <ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={{ padding: spacing.xl, gap: spacing.xl }}>
        <View style={{ gap: spacing.sm }}>
          <TextInput
            autoFocus={!existing}
            value={title}
            onChangeText={setTitle}
            placeholder={t('routines.title_placeholder')}
            placeholderTextColor={colors.textTertiary}
            accessibilityLabel={t('routines.title_placeholder')}
            style={[input(errors.title, showErrors), { fontSize: typography.heading.fontSize, fontFamily: fontFamily.semibold, minHeight: 52 }]}
          />
          <FieldError message={showErrors ? errors.title : null} />
        </View>

        <Field label={t('routines.period')} icon="clock">
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm }}>
            {PERIODS.map((p) => (
              <Chip key={p} icon={periodIcon[p]} label={t(`routines.period_${p}`)} selected={period === p} onPress={() => setPeriod(period === p ? null : p)} />
            ))}
          </View>
        </Field>

        <Field label={t('routines.repeat')} icon="repeat">
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm }}>
            {presets.map((p) => (
              <Chip key={p.key} label={t(`routines.rule_${p.key}`)} selected={same(days, p.days)} onPress={() => setDays(p.days)} />
            ))}
          </View>
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: spacing.xs }}>
            {WEEK_ORDER.map((d) => (
              <Chip key={d} label={dayName(d, i18n.language)} selected={days.includes(d)} onPress={() => toggleDay(d)} />
            ))}
          </View>
          <FieldError message={showErrors ? errors.days : null} />
        </Field>

        <Field label={t('tasks.time')} icon="clock">
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.sm }}>
            <TextInput value={startTime} onChangeText={setStartTime} placeholder="07:00" placeholderTextColor={colors.textTertiary} accessibilityLabel={t('task.start_time')} style={[input(errors.startTime, showErrors), { flex: 1 }]} />
            <Text color="textTertiary">–</Text>
            <TextInput value={endTime} onChangeText={setEndTime} placeholder="07:30" placeholderTextColor={colors.textTertiary} accessibilityLabel={t('task.end_time')} style={[input(errors.endTime, showErrors), { flex: 1 }]} />
          </View>
          <FieldError message={showErrors ? (errors.startTime ?? errors.endTime) : null} />
          <Text variant="caption" color="textSecondary">{t('routines.time_hint')}</Text>
        </Field>

        <Field label={t('task.energy')} icon="battery-charging">
          <View style={{ flexDirection: 'row', gap: spacing.sm }}>
            {energies.map((e) => (
              <Chip key={e.key} icon={e.icon} label={t(`task.energy_${e.key}`)} selected={energy === e.key} onPress={() => setEnergy(energy === e.key ? null : e.key)} />
            ))}
          </View>
        </Field>

        {areas.length ? (
          <Field label={t('tasks.project')} icon="folder">
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: spacing.sm }}>
              {areas.map((a) => (
                <Chip key={a.id} label={th ? a.nameTh : a.nameEn} selected={areaId === a.id} onPress={() => setAreaId(areaId === a.id ? null : a.id)} />
              ))}
            </ScrollView>
          </Field>
        ) : null}

        <Field label={t('routines.steps')} icon="check-square">
          {steps.map((step, i) => (
            <View key={`${i}-${step}`} style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.sm }}>
              <Text variant="label" color="textTertiary" style={{ width: 20, textAlign: 'right' }}>{i + 1}.</Text>
              <Text variant="body" style={{ flex: 1 }}>{step}</Text>
              <IconButton icon="x" label={t('tasks.remove_item', { text: step })} onPress={() => setSteps((prev) => prev.filter((_, j) => j !== i))} />
            </View>
          ))}
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.sm }}>
            <TextInput
              value={newStep}
              onChangeText={setNewStep}
              onSubmitEditing={addStep}
              returnKeyType="done"
              placeholder={t('routines.step_placeholder')}
              placeholderTextColor={colors.textTertiary}
              accessibilityLabel={t('routines.step_placeholder')}
              style={[input(), { flex: 1 }]}
            />
            <IconButton icon="plus" label={t('tasks.add_item')} color="primary" filled onPress={addStep} />
          </View>
        </Field>

        <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.md, minHeight: 44 }}>
          <View style={{ flex: 1, gap: 2 }}>
            <Text variant="label">{t('routines.active')}</Text>
            <Text variant="caption" color="textSecondary">{t('routines.active_hint')}</Text>
          </View>
          <Toggle value={active} onValueChange={setActive} label={t('routines.active')} />
        </View>
      </ScrollView>
    </Sheet>
  );
}

function NotFound({ onClose }: { onClose: () => void }) {
  const { t } = useTranslation();
  const { spacing } = useTheme();
  return (
    <Sheet onClose={onClose}>
      <View style={{ alignItems: 'center', gap: spacing.md, padding: spacing.xxl }}>
        <Mascot pose="search" size={104} />
        <Text variant="heading" align="center">{t('routines.not_found')}</Text>
        <Button label={t('common.close')} variant="secondary" onPress={onClose} />
      </View>
    </Sheet>
  );
}
