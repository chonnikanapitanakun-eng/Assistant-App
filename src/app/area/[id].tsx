import { router, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Pressable, ScrollView, TextInput, View } from 'react-native';

import { Mascot } from '@/components/brand/mascot';
import { Button, Chip, Field, FieldError, Icon, Sheet, Text, useInputStyle } from '@/components/ui';
import type { Area } from '@/db';
import { AREA_COLORS, AREA_ICONS, areaIcon, createArea, deleteArea, updateArea, useArea } from '@/features/areas/queries';
import { useAreas } from '@/features/tasks/queries';
import { useAsyncAction } from '@/lib/use-async-action';
import { useConfirm } from '@/lib/use-confirm';
import { useTheme } from '@/theme';

export default function AreaScreen() {
  const { id, parent } = useLocalSearchParams<{ id: string; parent?: string }>();
  const isNew = id === 'new';
  const { area, loaded } = useArea(isNew ? '' : id);
  const close = () => (router.canGoBack() ? router.back() : router.replace('/areas'));
  if (!isNew && !area) return loaded ? <NotFound onClose={close} /> : null;
  return <AreaForm key={area?.id ?? 'new'} existing={area} initialParent={parent ?? null} onClose={close} />;
}

function AreaForm({ existing, initialParent, onClose }: { existing?: Area; initialParent: string | null; onClose: () => void }) {
  const { t, i18n } = useTranslation();
  const { colors, spacing, radius } = useTheme();
  const input = useInputStyle();
  const all = useAreas();
  const { armed, confirm } = useConfirm();
  const { busy, failed, run } = useAsyncAction();
  const th = i18n.language === 'th';

  const [nameTh, setNameTh] = useState(existing?.nameTh ?? '');
  const [nameEn, setNameEn] = useState(existing?.nameEn ?? '');
  const [parentId, setParentId] = useState<string | null>(existing ? existing.parentId : initialParent);
  const [color, setColor] = useState<string | null>(existing?.color ?? (initialParent ? null : AREA_COLORS[0]));
  const [icon, setIcon] = useState<string | null>(existing?.icon ?? (initialParent ? null : 'folder'));
  const [showErrors, setShowErrors] = useState(false);

  // Two levels only: an area that already has projects stays top level; parents are top-level areas.
  const hasChildren = !!existing && all.some((a) => a.parentId === existing.id);
  const parents = all.filter((a) => !a.parentId && a.id !== existing?.id);
  const parent = all.find((a) => a.id === parentId) ?? null;
  // Projects may leave colour/icon empty to follow their area.
  const shownColor = color ?? parent?.color ?? colors.primary;
  const shownIcon = areaIcon({ icon }, parent);
  const nameError = !nameTh.trim() && !nameEn.trim() ? t('areas.name_required') : null;

  const save = () => {
    if (nameError) {
      setShowErrors(true);
      return;
    }
    // One name is enough: it fills in for the other language.
    const th_ = nameTh.trim() || nameEn.trim();
    const en_ = nameEn.trim() || nameTh.trim();
    const values = { nameTh: th_, nameEn: en_, parentId: hasChildren ? null : parentId, color, icon };
    void run(async () => {
      if (existing) await updateArea(existing.id, values);
      else await createArea(values, all.reduce((m, a) => Math.max(m, a.sortOrder), 0) + 1);
      onClose();
    });
  };

  return (
    <Sheet
      onClose={onClose}
      title={existing ? t('areas.edit') : parentId ? t('areas.add_project') : t('areas.add_area')}
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
              accessibilityHint={hasChildren ? t('areas.delete_hint_children') : t('areas.delete_hint')}
              disabled={busy}
              onPress={() => confirm(() => void run(async () => { await deleteArea(existing.id); onClose(); }))}
            />
          ) : null}
        </View>
      }
    >
      <ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={{ padding: spacing.xl, gap: spacing.xl }}>
        <Field label={t('areas.name_th')} icon="type">
          <TextInput autoFocus={!existing && th} value={nameTh} onChangeText={setNameTh} placeholderTextColor={colors.textTertiary} accessibilityLabel={t('areas.name_th')} style={input(nameError, showErrors)} />
        </Field>
        <Field label={t('areas.name_en')} icon="type">
          <TextInput autoFocus={!existing && !th} value={nameEn} onChangeText={setNameEn} placeholderTextColor={colors.textTertiary} accessibilityLabel={t('areas.name_en')} style={input(nameError, showErrors)} />
          <FieldError message={showErrors ? nameError : null} />
        </Field>

        <Field label={t('areas.color')} icon="droplet">
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm }}>
            {parentId ? <Chip label={t('areas.same_as_area')} selected={color === null} onPress={() => setColor(null)} /> : null}
            {AREA_COLORS.map((c) => (
              <Pressable
                key={c}
                accessibilityRole="radio"
                accessibilityState={{ selected: color === c }}
                accessibilityLabel={t('areas.color_option', { color: c })}
                onPress={() => setColor(c)}
                style={{ width: 44, height: 44, borderRadius: 22, alignItems: 'center', justifyContent: 'center', borderWidth: 2, borderColor: color === c ? colors.text : 'transparent' }}
              >
                <View style={{ width: 32, height: 32, borderRadius: 16, backgroundColor: c, alignItems: 'center', justifyContent: 'center' }}>
                  {color === c ? <Icon name="check" size={16} tone="#FFFFFF" /> : null}
                </View>
              </Pressable>
            ))}
          </View>
        </Field>

        <Field label={t('areas.icon')} icon="grid">
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm }}>
            {parentId ? <Chip label={t('areas.same_as_area')} selected={icon === null} onPress={() => setIcon(null)} /> : null}
            {AREA_ICONS.map((name) => {
              const selected = icon === name;
              return (
                <Pressable
                  key={name}
                  accessibilityRole="radio"
                  accessibilityState={{ selected }}
                  accessibilityLabel={name}
                  onPress={() => setIcon(name)}
                  style={{ width: 44, height: 44, borderRadius: radius.md, alignItems: 'center', justifyContent: 'center', backgroundColor: selected ? shownColor : colors.surface, borderWidth: 1, borderColor: selected ? shownColor : colors.border }}
                >
                  <Icon name={name} size={18} tone={selected ? '#FFFFFF' : colors.textSecondary} />
                </Pressable>
              );
            })}
          </View>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.sm }}>
            <View style={{ width: 32, height: 32, borderRadius: radius.md, backgroundColor: shownColor, alignItems: 'center', justifyContent: 'center' }}>
              <Icon name={shownIcon} size={16} tone="#FFFFFF" />
            </View>
            <Text variant="caption" color="textSecondary">{t('areas.preview')}</Text>
          </View>
        </Field>

        {hasChildren ? null : (
          <Field label={t('areas.parent')} icon="folder">
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm }}>
              <Chip label={t('areas.top_level')} selected={parentId === null} onPress={() => setParentId(null)} />
              {parents.map((a) => (
                <Chip key={a.id} label={th ? a.nameTh : a.nameEn} selected={parentId === a.id} onPress={() => setParentId(a.id)} />
              ))}
            </View>
            <Text variant="caption" color="textSecondary">{t('areas.parent_hint')}</Text>
          </Field>
        )}
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
        <Text variant="heading" align="center">{t('areas.not_found')}</Text>
        <Button label={t('common.close')} variant="secondary" onPress={onClose} />
      </View>
    </Sheet>
  );
}
