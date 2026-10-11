import { router, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Linking, ScrollView, TextInput, View, type KeyboardTypeOptions } from 'react-native';

import { Mascot } from '@/components/brand/mascot';
import { Button, Chip, Field, FieldError, Sheet, Text, useInputStyle, type IconName } from '@/components/ui';
import type { Contact } from '@/db';
import { createContact, deleteContact, updateContact, useContact } from '@/features/contacts/queries';
import { RelatedSection } from '@/features/links/components/related-section';
import { useAreas } from '@/features/tasks/queries';
import { useAsyncAction } from '@/lib/use-async-action';
import { useConfirm } from '@/lib/use-confirm';
import { useTheme } from '@/theme';

export default function ContactScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const isNew = id === 'new';
  const { contact, loaded } = useContact(isNew ? '' : id);
  const close = () => (router.canGoBack() ? router.back() : router.replace('/contacts'));
  if (!isNew && !contact) return loaded ? <NotFound onClose={close} /> : null;
  return <ContactForm key={contact?.id ?? 'new'} existing={contact} onClose={close} />;
}

const blank = (v: string) => v.trim() || null;

function ContactForm({ existing, onClose }: { existing?: Contact; onClose: () => void }) {
  const { t, i18n } = useTranslation();
  const { colors, spacing, typography, fontFamily } = useTheme();
  const input = useInputStyle();
  const areas = useAreas().filter((a) => a.parentId);
  const { armed, confirm } = useConfirm();
  const { busy, failed, run } = useAsyncAction();
  const th = i18n.language === 'th';

  const [name, setName] = useState(existing?.name ?? '');
  const [company, setCompany] = useState(existing?.company ?? '');
  const [role, setRole] = useState(existing?.role ?? '');
  const [email, setEmail] = useState(existing?.email ?? '');
  const [phone, setPhone] = useState(existing?.phone ?? '');
  const [lineId, setLineId] = useState(existing?.lineId ?? '');
  const [notes, setNotes] = useState(existing?.notes ?? '');
  const [areaId, setAreaId] = useState(existing?.areaId ?? null);
  const [showErrors, setShowErrors] = useState(false);
  const nameError = !name.trim() ? t('contacts.name_required') : null;

  const save = () => {
    if (nameError) {
      setShowErrors(true);
      return;
    }
    const values = { name: name.trim(), company: blank(company), role: blank(role), email: blank(email), phone: blank(phone), lineId: blank(lineId), notes: blank(notes), areaId };
    void run(async () => {
      if (existing) await updateContact(existing.id, values);
      else await createContact(values);
      onClose();
    });
  };

  const line = (label: string, icon: IconName, value: string, set: (v: string) => void, keyboardType?: KeyboardTypeOptions) => (
    <Field label={label} icon={icon}>
      <TextInput value={value} onChangeText={set} keyboardType={keyboardType} autoCapitalize={keyboardType ? 'none' : 'sentences'} autoCorrect={!keyboardType} placeholderTextColor={colors.textTertiary} accessibilityLabel={label} style={input()} />
    </Field>
  );

  return (
    <Sheet
      wide="side"
      onClose={onClose}
      title={existing ? t('contacts.edit') : t('contacts.add')}
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
              accessibilityHint={t('contacts.delete_hint')}
              disabled={busy}
              onPress={() => confirm(() => void run(async () => { await deleteContact(existing.id); onClose(); }))}
            />
          ) : null}
        </View>
      }
    >
      <ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={{ padding: spacing.xl, gap: spacing.xl }}>
        <View style={{ gap: spacing.sm }}>
          <TextInput
            autoFocus={!existing}
            value={name}
            onChangeText={setName}
            placeholder={t('contacts.name_placeholder')}
            placeholderTextColor={colors.textTertiary}
            accessibilityLabel={t('contacts.name_placeholder')}
            style={[input(nameError, showErrors), { fontSize: typography.heading.fontSize, fontFamily: fontFamily.semibold, minHeight: 52 }]}
          />
          <FieldError message={showErrors ? nameError : null} />
        </View>

        {existing && (existing.phone || existing.email) ? (
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm }}>
            {existing.phone ? <Button size="sm" variant="secondary" icon="phone" label={t('contacts.call')} onPress={() => void Linking.openURL(`tel:${existing.phone!.replace(/[^\d+]/g, '')}`)} /> : null}
            {existing.email ? <Button size="sm" variant="secondary" icon="mail" label={t('contacts.email_action')} onPress={() => void Linking.openURL(`mailto:${existing.email}`)} /> : null}
          </View>
        ) : null}

        {line(t('contacts.company'), 'briefcase', company, setCompany)}
        {line(t('contacts.role'), 'user', role, setRole)}
        {line(t('contacts.phone'), 'phone', phone, setPhone, 'phone-pad')}
        {line(t('contacts.email'), 'mail', email, setEmail, 'email-address')}
        {line('LINE ID', 'message-circle', lineId, setLineId, 'default')}

        {areas.length ? (
          <Field label={t('tasks.project')} icon="folder">
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: spacing.sm }}>
              {areas.map((a) => (
                <Chip key={a.id} label={th ? a.nameTh : a.nameEn} selected={areaId === a.id} onPress={() => setAreaId(areaId === a.id ? null : a.id)} />
              ))}
            </ScrollView>
          </Field>
        ) : null}

        <Field label={t('contacts.notes')} icon="file-text">
          <TextInput value={notes} onChangeText={setNotes} multiline placeholderTextColor={colors.textTertiary} accessibilityLabel={t('contacts.notes')} style={[input(), { minHeight: 88, textAlignVertical: 'top' }]} />
        </Field>

        {existing ? <RelatedSection self={{ type: 'contact', id: existing.id }} types={['task', 'event', 'note', 'transaction']} /> : null}
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
        <Text variant="heading" align="center">{t('contacts.not_found')}</Text>
        <Button label={t('common.close')} variant="secondary" onPress={onClose} />
      </View>
    </Sheet>
  );
}
