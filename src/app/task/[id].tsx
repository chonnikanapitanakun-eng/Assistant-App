import { Ionicons } from '@expo/vector-icons';
import { router, useLocalSearchParams } from 'expo-router';
import { useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Alert, Pressable, Switch, TextInput, View } from 'react-native';

import { Card, Screen, Text } from '@/components/ui';
import { createTask, deleteTask, updateTask, useTask, type ChecklistItem } from '@/features/tasks/queries';
import { toDateKey } from '@/lib/date';
import { newId } from '@/lib/ids';
import { useTheme } from '@/theme';

const priorities = [1, 2, 3] as const;
const energies = ['low', 'med', 'high'] as const;

export default function TaskDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const isNew = id === 'new';
  const { t } = useTranslation();
  const { colors, radius, spacing } = useTheme();
  const existing = useTask(isNew ? '' : id);
  const hydrated = useRef(false);

  const [title, setTitle] = useState('');
  const [notes, setNotes] = useState('');
  const [date, setDate] = useState(toDateKey());
  const [startTime, setStartTime] = useState('');
  const [endTime, setEndTime] = useState('');
  const [priority, setPriority] = useState<number>(2);
  const [energy, setEnergy] = useState<'low' | 'med' | 'high' | null>(null);
  const [isDone, setIsDone] = useState(false);
  const [checklist, setChecklist] = useState<ChecklistItem[]>([]);
  const [newItemText, setNewItemText] = useState('');

  useEffect(() => {
    if (existing && !hydrated.current) {
      hydrated.current = true;
      setTitle(existing.title);
      setNotes(existing.notes ?? '');
      setDate(existing.date ?? toDateKey());
      setStartTime(existing.startTime ?? '');
      setEndTime(existing.endTime ?? '');
      setPriority(existing.priority);
      setEnergy(existing.energy);
      setIsDone(existing.isDone);
      setChecklist(existing.checklist ?? []);
    }
  }, [existing]);

  if (!isNew && !existing) {
    return (
      <Screen>
        <Text color="textSecondary" style={{ textAlign: 'center', marginTop: 24 }}>{t('task.not_found')}</Text>
      </Screen>
    );
  }

  const addChecklistItem = () => {
    const text = newItemText.trim();
    if (!text) return;
    setChecklist((prev) => [...prev, { id: newId(), text, done: false }]);
    setNewItemText('');
  };

  const toggleChecklistItem = (itemId: string) => {
    setChecklist((prev) => prev.map((item) => (item.id === itemId ? { ...item, done: !item.done } : item)));
  };

  const removeChecklistItem = (itemId: string) => {
    setChecklist((prev) => prev.filter((item) => item.id !== itemId));
  };

  const onSave = () => {
    const trimmedTitle = title.trim();
    if (!trimmedTitle) {
      Alert.alert(t('task.title_required'));
      return;
    }
    const values = {
      title: trimmedTitle,
      notes: notes.trim() || null,
      date: date.trim() || null,
      startTime: startTime.trim() || null,
      endTime: endTime.trim() || null,
      priority,
      energy,
      isDone,
      checklist: checklist.length > 0 ? checklist : null,
    };
    if (isNew) {
      createTask(values);
    } else {
      updateTask(id, values);
    }
    router.back();
  };

  const onDelete = () => {
    Alert.alert(t('task.delete_confirm_title'), t('task.delete_confirm_message'), [
      { text: t('common.cancel'), style: 'cancel' },
      {
        text: t('common.delete'),
        style: 'destructive',
        onPress: () => {
          deleteTask(id);
          router.back();
        },
      },
    ]);
  };

  const inputStyle = {
    backgroundColor: colors.surface,
    color: colors.text,
    borderRadius: radius.md,
    padding: spacing.md,
    borderWidth: 1,
    borderColor: colors.border,
    fontSize: 16,
  };

  return (
    <Screen>
      <Text variant="title">{isNew ? t('task.new_title') : t('task.edit_title')}</Text>

      <TextInput
        autoFocus={isNew}
        value={title}
        onChangeText={setTitle}
        placeholder={t('task.title_placeholder')}
        placeholderTextColor={colors.textSecondary}
        style={inputStyle}
      />

      <TextInput
        value={notes}
        onChangeText={setNotes}
        placeholder={t('task.notes_placeholder')}
        placeholderTextColor={colors.textSecondary}
        multiline
        style={[inputStyle, { minHeight: 72, textAlignVertical: 'top' }]}
      />

      <View style={{ flexDirection: 'row', gap: spacing.sm }}>
        <View style={{ flex: 1, gap: spacing.xs }}>
          <Text variant="caption" color="textSecondary">{t('task.date')}</Text>
          <TextInput value={date} onChangeText={setDate} placeholder="YYYY-MM-DD" placeholderTextColor={colors.textSecondary} style={inputStyle} />
        </View>
        <View style={{ flex: 1, gap: spacing.xs }}>
          <Text variant="caption" color="textSecondary">{t('task.start_time')}</Text>
          <TextInput value={startTime} onChangeText={setStartTime} placeholder="HH:mm" placeholderTextColor={colors.textSecondary} style={inputStyle} />
        </View>
        <View style={{ flex: 1, gap: spacing.xs }}>
          <Text variant="caption" color="textSecondary">{t('task.end_time')}</Text>
          <TextInput value={endTime} onChangeText={setEndTime} placeholder="HH:mm" placeholderTextColor={colors.textSecondary} style={inputStyle} />
        </View>
      </View>

      <View style={{ gap: spacing.xs }}>
        <Text variant="caption" color="textSecondary">{t('task.priority')}</Text>
        <View style={{ flexDirection: 'row', gap: spacing.sm }}>
          {priorities.map((p) => (
            <Pressable
              key={p}
              onPress={() => setPriority(p)}
              style={{ paddingVertical: 8, paddingHorizontal: 16, borderRadius: radius.pill, backgroundColor: priority === p ? colors.primary : colors.surfaceAlt }}
            >
              <Text color={priority === p ? 'onPrimary' : 'text'}>{t(`task.priority_${p}`)}</Text>
            </Pressable>
          ))}
        </View>
      </View>

      <View style={{ gap: spacing.xs }}>
        <Text variant="caption" color="textSecondary">{t('task.energy')}</Text>
        <View style={{ flexDirection: 'row', gap: spacing.sm }}>
          {energies.map((e) => (
            <Pressable
              key={e}
              onPress={() => setEnergy(energy === e ? null : e)}
              style={{ paddingVertical: 8, paddingHorizontal: 16, borderRadius: radius.pill, backgroundColor: energy === e ? colors.primary : colors.surfaceAlt }}
            >
              <Text color={energy === e ? 'onPrimary' : 'text'}>{t(`task.energy_${e}`)}</Text>
            </Pressable>
          ))}
        </View>
      </View>

      <Card style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
        <Text>{t('task.mark_done')}</Text>
        <Switch value={isDone} onValueChange={setIsDone} trackColor={{ true: colors.primary }} />
      </Card>

      <View style={{ gap: spacing.sm }}>
        <Text variant="caption" color="textSecondary">{t('task.checklist')}</Text>
        {checklist.map((item) => (
          <View key={item.id} style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.sm }}>
            <Pressable onPress={() => toggleChecklistItem(item.id)} hitSlop={8}>
              <Ionicons name={item.done ? 'checkmark-circle' : 'ellipse-outline'} size={22} color={item.done ? colors.primary : colors.textSecondary} />
            </Pressable>
            <Text style={[{ flex: 1 }, item.done ? { textDecorationLine: 'line-through', color: colors.textSecondary } : undefined]}>{item.text}</Text>
            <Pressable onPress={() => removeChecklistItem(item.id)} hitSlop={8}>
              <Ionicons name="close" size={20} color={colors.textSecondary} />
            </Pressable>
          </View>
        ))}
        <View style={{ flexDirection: 'row', gap: spacing.sm }}>
          <TextInput
            value={newItemText}
            onChangeText={setNewItemText}
            onSubmitEditing={addChecklistItem}
            placeholder={t('task.checklist_placeholder')}
            placeholderTextColor={colors.textSecondary}
            style={[inputStyle, { flex: 1 }]}
          />
          <Pressable onPress={addChecklistItem} style={{ width: 48, borderRadius: radius.md, backgroundColor: colors.surfaceAlt, alignItems: 'center', justifyContent: 'center' }}>
            <Ionicons name="add" size={22} color={colors.text} />
          </Pressable>
        </View>
      </View>

      <View style={{ flexDirection: 'row', gap: spacing.sm, marginTop: spacing.md }}>
        <Pressable onPress={() => router.back()} style={{ flex: 1, padding: spacing.md, borderRadius: radius.md, backgroundColor: colors.surfaceAlt, alignItems: 'center' }}>
          <Text>{t('common.cancel')}</Text>
        </Pressable>
        <Pressable onPress={onSave} style={{ flex: 1, padding: spacing.md, borderRadius: radius.md, backgroundColor: colors.primary, alignItems: 'center' }}>
          <Text color="onPrimary">{t('common.save')}</Text>
        </Pressable>
      </View>

      {!isNew ? (
        <Pressable onPress={onDelete} style={{ padding: spacing.md, borderRadius: radius.md, alignItems: 'center' }}>
          <Text color="expense">{t('common.delete')}</Text>
        </Pressable>
      ) : null}
    </Screen>
  );
}
