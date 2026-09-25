import { router, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Platform, ScrollView, TextInput, View } from 'react-native';

import { Mascot } from '@/components/brand/mascot';
import { Button, Chip, Field, FieldError, Icon, IconButton, type IconName, PressableScale, Sheet, showToast, Text, Toggle, useInputStyle } from '@/components/ui';
import type { Task } from '@/db';
import { DateField, TimeRangeField } from '@/features/calendar/components/date-field';
import { ReminderChips, RepeatChips } from '@/features/calendar/components/repeat-remind';
import { isValidDate, isValidTime, priorityLevel, priorityTint, priorityValue, type PriorityLevel } from '@/features/tasks/model';
import { RelatedSection } from '@/features/links/components/related-section';
import { createTask, deleteTask, restoreTask, updateTask, useAreas, useTask, type ChecklistItem, type TaskFormValues } from '@/features/tasks/queries';
import { addDays, toDateKey } from '@/lib/date';
import { newId } from '@/lib/ids';
import type { RepeatRule } from '@/lib/recurrence';
import { useAsyncAction } from '@/lib/use-async-action';
import { useConfirm } from '@/lib/use-confirm';
import { useDirty } from '@/lib/use-dirty';
import { useDraft } from '@/lib/use-draft';
import { useTheme } from '@/theme';

const levels: PriorityLevel[] = ['high', 'medium', 'low'];
const energies: { key: 'low' | 'med' | 'high'; icon: IconName }[] = [
  { key: 'low', icon: 'battery' },
  { key: 'med', icon: 'battery-charging' },
  { key: 'high', icon: 'zap' },
];

export default function TaskDetailScreen() {
  const { id, date: dateParam } = useLocalSearchParams<{ id: string; date?: string }>();
  const isNew = id === 'new';
  const { task: existing, loaded } = useTask(isNew ? '' : id);
  const close = () => (router.canGoBack() ? router.back() : router.replace('/tasks'));

  if (!isNew && !existing) return loaded ? <NotFound onClose={close} /> : null;
  return <TaskForm key={existing?.id ?? 'new'} existing={existing} initialDate={dateParam} onClose={close} />;
}

function TaskForm({ existing, initialDate, onClose }: { existing?: Task; initialDate?: string; onClose: () => void }) {
  const { t, i18n } = useTranslation();
  const { colors, tints, spacing, radius, typography, fontFamily } = useTheme();
  const inputStyle = useInputStyle();
  const areas = useAreas().filter((a) => a.parentId);
  const th = i18n.language === 'th';

  const draft = `task:${existing?.id ?? 'new'}`;
  const [title, setTitle] = useDraft(`${draft}:title`, existing?.title ?? '');
  const [notes, setNotes] = useDraft(`${draft}:notes`, existing?.notes ?? '');
  const [date, setDate] = useDraft(`${draft}:date`, existing ? (existing.date ?? '') : (initialDate ?? toDateKey()));
  const [startTime, setStartTime] = useDraft(`${draft}:startTime`, existing?.startTime ?? '');
  const [endTime, setEndTime] = useDraft(`${draft}:endTime`, existing?.endTime ?? '');
  const [priority, setPriority] = useDraft<PriorityLevel>(`${draft}:priority`, priorityLevel(existing?.priority ?? 2));
  const [energy, setEnergy] = useDraft(`${draft}:energy`, existing?.energy ?? null);
  const [areaId, setAreaId] = useDraft(`${draft}:areaId`, existing?.areaId ?? null);
  const [isDone, setIsDone] = useDraft(`${draft}:isDone`, existing?.isDone ?? false);
  const [remindBefore, setRemindBefore] = useDraft<number | null>(`${draft}:remindBefore`, existing ? existing.remindBefore : null);
  const [repeat, setRepeat] = useDraft<RepeatRule | null>(`${draft}:repeat`, existing?.repeat ?? null);
  // New tasks remind at the start time once one is picked, unless the reminder was set by hand.
  const [remindTouched, setRemindTouched] = useState(!!existing);
  const pickStart = (v: string) => {
    setStartTime(v);
    if (!remindTouched && v && remindBefore === null) setRemindBefore(0);
  };
  const pickReminder = (v: number | null) => {
    setRemindTouched(true);
    setRemindBefore(v);
  };
  const [checklist, setChecklist] = useDraft<ChecklistItem[]>(`${draft}:checklist`, existing?.checklist ?? []);
  const [newItem, setNewItem] = useDraft(`${draft}:newItem`, '');
  const [showErrors, setShowErrors] = useState(false);
  const { armed: confirmDelete, confirm } = useConfirm();
  const { busy, failed, run } = useAsyncAction();
  const dirty = useDirty({ title, notes, date, startTime, endTime, priority, energy, areaId, isDone, remindBefore, repeat, checklist, newItem });

  const errors = {
    title: !title.trim() ? t('task.title_required') : null,
    date: date && !isValidDate(date) ? t('tasks.invalid_date') : null,
    startTime: startTime && !isValidTime(startTime) ? t('tasks.invalid_time') : null,
    endTime: endTime && (!isValidTime(endTime) || (isValidTime(startTime) && endTime <= startTime)) ? t('tasks.invalid_end') : null,
  };
  const hasErrors = Object.values(errors).some(Boolean);
  const hasDate = !!date && isValidDate(date);

  const quickDates = [
    { key: 'today', value: toDateKey() },
    { key: 'tomorrow', value: toDateKey(addDays(new Date(), 1)) },
    { key: 'next_week', value: toDateKey(addDays(new Date(), 7)) },
    { key: 'no_date', value: '' },
  ];

  const onSave = () => {
    if (hasErrors) {
      setShowErrors(true);
      return;
    }
    const values: TaskFormValues = {
      title: title.trim(),
      notes: notes.trim() || null,
      date: date || null,
      startTime: startTime || null,
      endTime: endTime || null,
      priority: priorityValue[priority],
      energy,
      areaId,
      isDone,
      checklist: checklist.length ? checklist : null,
      remindBefore: hasDate ? remindBefore : null,
      repeat: hasDate ? repeat : null,
    };
    void run(async () => {
      if (existing) await updateTask(existing, values);
      else await createTask(values);
      showToast(t('common.saved'), undefined, 'success');
      onClose();
    });
  };

  const onDelete = () => {
    if (!existing) return;
    confirm(() =>
      void run(async () => {
        await deleteTask(existing);
        showToast(t('tasks.deleted_toast', { title: existing.title }), { label: t('common.undo'), onPress: () => void restoreTask(existing) }, 'warning');
        onClose();
      }),
    );
  };

  const addItem = () => {
    const text = newItem.trim();
    if (!text) return;
    setChecklist((prev) => [...prev, { id: newId(), text, done: false }]);
    setNewItem('');
  };

  const input = (error?: string | null) => inputStyle(error, showErrors);

  return (
    <Sheet
      wide="side"
      onClose={onClose}
      dirty={dirty}
      title={existing ? t('task.edit_title') : t('task.new_title')}
      footer={
        <View style={{ gap: spacing.sm }}>
          <FieldError message={failed ? t('common.save_failed') : null} />
          <Button fullWidth icon="check" label={t('common.save')} disabled={busy} onPress={onSave} />
          {existing ? (
            <Button
              fullWidth
              variant="ghost"
              icon="trash-2"
              label={confirmDelete ? t('tasks.delete_confirm') : t('common.delete')}
              accessibilityHint={t('task.delete_confirm_message')}
              disabled={busy}
              onPress={onDelete}
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
            placeholder={t('task.title_placeholder')}
            placeholderTextColor={colors.textTertiary}
            accessibilityLabel={t('task.title_placeholder')}
            style={[input(errors.title), { fontSize: typography.heading.fontSize, fontFamily: fontFamily.semibold, minHeight: 52 }]}
          />
          <FieldError message={showErrors ? errors.title : null} />
          <TextInput
            value={notes}
            onChangeText={setNotes}
            placeholder={t('task.notes_placeholder')}
            placeholderTextColor={colors.textTertiary}
            accessibilityLabel={t('task.notes_placeholder')}
            multiline
            style={[input(), { minHeight: 72, paddingVertical: spacing.md, textAlignVertical: 'top' }]}
          />
        </View>

        <Field label={t('task.date')} icon="calendar">
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm }}>
            {quickDates.map((q) => (
              <Chip key={q.key} label={t(`tasks.date_${q.key}`)} selected={date === q.value} onPress={() => setDate(q.value)} />
            ))}
          </View>
          <DateField value={date} onChange={setDate} invalid={showErrors && !!errors.date} />
          <FieldError message={showErrors ? errors.date : null} />
        </Field>

        <Field label={t('tasks.time')} icon="clock">
          <TimeRangeField start={startTime} end={endTime} onChangeStart={pickStart} onChangeEnd={setEndTime} invalid={showErrors && !!(errors.startTime ?? errors.endTime)} clearable />
          <FieldError message={showErrors ? (errors.startTime ?? errors.endTime) : null} />
        </Field>

        <Field label={t('remind.title')} icon="bell">
          {hasDate ? <ReminderChips value={remindBefore} onChange={pickReminder} timed={isValidTime(startTime)} /> : <Text variant="caption" color="textTertiary">{t('remind.needs_date')}</Text>}
          {hasDate && remindBefore !== null && Platform.OS === 'web' ? <Text variant="caption" color="textTertiary">{t('remind.no_web')}</Text> : null}
        </Field>

        <Field label={t('repeat.title')} icon="repeat">
          {hasDate ? <RepeatChips value={repeat} onChange={setRepeat} /> : <Text variant="caption" color="textTertiary">{t('repeat.needs_date')}</Text>}
          {hasDate && repeat ? <Text variant="caption" color="textTertiary">{t('repeat.task_hint')}</Text> : null}
        </Field>

        <Field label={t('task.priority')} icon="flag">
          <View style={{ flexDirection: 'row', gap: spacing.sm }}>
            {levels.map((l) => {
              const tint = tints[priorityTint[l]];
              const on = priority === l;
              return (
                <PressableScale
                  key={l}
                  accessibilityRole="radio"
                  accessibilityState={{ checked: on }}
                  accessibilityLabel={t(`home.priority_${l}`)}
                  onPress={() => setPriority(l)}
                  style={{ flex: 1, minHeight: 44, alignItems: 'center', justifyContent: 'center', borderRadius: radius.md, borderWidth: 1.5, borderColor: on ? tint.fg : colors.border, backgroundColor: on ? tint.bg : 'transparent' }}
                >
                  <Text variant="label" weight="semibold" tone={on ? tint.fg : colors.textSecondary}>{t(`home.priority_${l}`)}</Text>
                </PressableScale>
              );
            })}
          </View>
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

        <Field label={`${t('task.checklist')}${checklist.length ? ` · ${checklist.filter((c) => c.done).length}/${checklist.length}` : ''}`} icon="check-square">
          {checklist.map((item) => (
            <View key={item.id} style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.xs }}>
              <PressableScale
                accessibilityRole="checkbox"
                accessibilityState={{ checked: item.done }}
                accessibilityLabel={item.text}
                onPress={() => setChecklist((prev) => prev.map((c) => (c.id === item.id ? { ...c, done: !c.done } : c)))}
                style={{ width: 44, height: 44, alignItems: 'center', justifyContent: 'center' }}
              >
                <View style={{ width: 20, height: 20, borderRadius: 6, borderWidth: 2, borderColor: item.done ? colors.success : colors.borderStrong, backgroundColor: item.done ? colors.success : 'transparent', alignItems: 'center', justifyContent: 'center' }}>
                  {item.done ? <Icon name="check" size={12} tone={colors.onPrimary} /> : null}
                </View>
              </PressableScale>
              <Text variant="body" color={item.done ? 'textTertiary' : 'text'} style={[{ flex: 1 }, item.done ? { textDecorationLine: 'line-through' } : null]}>{item.text}</Text>
              <IconButton icon="x" label={t('tasks.remove_item', { text: item.text })} onPress={() => setChecklist((prev) => prev.filter((c) => c.id !== item.id))} />
            </View>
          ))}
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.sm }}>
            <TextInput
              value={newItem}
              onChangeText={setNewItem}
              onSubmitEditing={addItem}
              returnKeyType="done"
              placeholder={t('task.checklist_placeholder')}
              placeholderTextColor={colors.textTertiary}
              accessibilityLabel={t('task.checklist_placeholder')}
              style={[input(), { flex: 1 }]}
            />
            <IconButton icon="plus" label={t('tasks.add_item')} color="primary" filled onPress={addItem} />
          </View>
        </Field>

        {existing ? <RelatedSection self={{ type: 'task', id: existing.id }} /> : null}

        {existing && !existing.isDone ? (
          <Button variant="secondary" icon="target" label={t('focus.start_for_task')} onPress={() => router.push({ pathname: '/focus', params: { taskId: existing.id } })} />
        ) : null}

        {existing ? (
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.md, minHeight: 44, padding: spacing.md, borderRadius: radius.lg, backgroundColor: isDone ? tints.done.bg : colors.surfaceMuted }}>
            <Icon name="check-circle" size={18} tone={isDone ? tints.done.fg : colors.textSecondary} />
            <Text variant="label" style={{ flex: 1 }}>{t('task.mark_done')}</Text>
            <Toggle value={isDone} onValueChange={setIsDone} label={t('task.mark_done')} tone="success" />
          </View>
        ) : null}
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
        <Text variant="heading" align="center">{t('task.not_found')}</Text>
        <Text variant="bodySm" color="textSecondary" align="center">{t('tasks.not_found_body')}</Text>
        <Button label={t('common.close')} variant="secondary" onPress={onClose} />
      </View>
    </Sheet>
  );
}
