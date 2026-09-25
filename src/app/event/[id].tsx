import { router, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Platform, ScrollView, TextInput, View } from 'react-native';

import { Mascot } from '@/components/brand/mascot';
import { Button, Chip, Field, FieldError, Sheet, showToast, Text, Toggle, useInputStyle } from '@/components/ui';
import type { CalendarEvent } from '@/db';
import { DateField, TimeRangeField } from '@/features/calendar/components/date-field';
import { ReminderChips, RepeatChips } from '@/features/calendar/components/repeat-remind';
import { eventToItem, fromMinutes, toMinutes } from '@/features/calendar/model';
import { createEvent, deleteEvent, updateEvent, useEvent, type EventFormValues } from '@/features/calendar/queries';
import { useCalendarAccounts } from '@/features/google-calendar';
import { RelatedSection } from '@/features/links/components/related-section';
import { isValidDate, isValidTime } from '@/features/tasks/model';
import { addDays, toDateKey } from '@/lib/date';
import type { RepeatRule } from '@/lib/recurrence';
import { useAsyncAction } from '@/lib/use-async-action';
import { useConfirm } from '@/lib/use-confirm';
import { useDirty } from '@/lib/use-dirty';
import { useDraft } from '@/lib/use-draft';
import { useTheme } from '@/theme';

export default function EventScreen() {
  const { id, date, start } = useLocalSearchParams<{ id: string; date?: string; start?: string }>();
  const isNew = id === 'new';
  const { event, contactName, loaded } = useEvent(isNew ? '' : id);
  const close = () => (router.canGoBack() ? router.back() : router.replace('/calendar'));

  if (!isNew && !event) return loaded ? <NotFound onClose={close} /> : null;
  // useEvent loads the event and its linked contact together, so the form mounts with both.
  return <EventForm key={event?.id ?? 'new'} existing={event} contactName={contactName} initialDate={date} initialStart={start} onClose={close} />;
}

/** Next whole hour from now, capped so the default 1h event stays within the day. */
function nextHour() {
  const d = new Date();
  return fromMinutes(Math.min((d.getHours() + 1) * 60, 22 * 60));
}

type FormProps = { existing?: CalendarEvent; contactName: string | null; initialDate?: string; initialStart?: string; onClose: () => void };

function EventForm({ existing, contactName, initialDate, initialStart, onClose }: FormProps) {
  const { t } = useTranslation();
  const { colors, spacing, typography, fontFamily } = useTheme();
  const inputStyle = useInputStyle();
  const item = existing ? eventToItem(existing) : null;
  const defaultStart = initialStart && isValidTime(initialStart) ? initialStart : nextHour();

  const draft = `event:${existing?.id ?? 'new'}`;
  const [title, setTitle] = useDraft(`${draft}:title`, existing?.title ?? '');
  const [date, setDate] = useDraft(`${draft}:date`, item?.date ?? initialDate ?? toDateKey());
  const [allDay, setAllDay] = useDraft(`${draft}:allDay`, existing?.isAllDay ?? false);
  const [startTime, setStartTime] = useDraft(`${draft}:startTime`, item?.start ?? defaultStart);
  const [endTime, setEndTime] = useDraft(`${draft}:endTime`, item?.end ?? fromMinutes(Math.min(toMinutes(defaultStart) + 60, 23 * 60 + 59)));
  const [location, setLocation] = useDraft(`${draft}:location`, existing?.location ?? '');
  const [person, setPerson] = useDraft(`${draft}:person`, contactName ?? '');
  const [repeat, setRepeat] = useDraft<RepeatRule | null>(`${draft}:repeat`, existing?.repeat ?? null);
  const [remindBefore, setRemindBefore] = useDraft<number | null>(`${draft}:remindBefore`, existing ? existing.remindBefore : 10);
  const [showErrors, setShowErrors] = useState(false);
  const { armed: confirmDelete, confirm } = useConfirm();
  const { busy, failed, run } = useAsyncAction();
  const dirty = useDirty({ title, date, allDay, startTime, endTime, location, person, repeat, remindBefore });
  const readOnly = !!existing && existing.source !== 'veyra';
  const account = useCalendarAccounts().find((a) => a.id === existing?.accountId);
  const sourceLabel = existing?.source === 'google' ? ['Google', account?.email, existing.calendarName !== account?.email ? existing.calendarName : null].filter(Boolean).join(' · ') : existing?.source;

  const errors = {
    title: !title.trim() ? t('calendar.title_required') : null,
    date: !isValidDate(date) ? t('tasks.invalid_date') : null,
    time: allDay ? null : !isValidTime(startTime) || !isValidTime(endTime) ? t('tasks.invalid_time') : endTime <= startTime ? t('tasks.invalid_end') : null,
  };
  const hasErrors = Object.values(errors).some(Boolean);

  const quickDates = [
    { key: 'today', value: toDateKey() },
    { key: 'tomorrow', value: toDateKey(addDays(new Date(), 1)) },
    { key: 'next_week', value: toDateKey(addDays(new Date(), 7)) },
  ];

  const onSave = () => {
    if (hasErrors) {
      setShowErrors(true);
      return;
    }
    const values: EventFormValues = { title: title.trim(), date, allDay, startTime, endTime, location: location.trim() || null, contactName: person.trim() || null, repeat, remindBefore };
    void run(async () => {
      if (existing) await updateEvent(existing.id, values);
      else await createEvent(values);
      showToast(t('common.saved'), undefined, 'success');
      onClose();
    });
  };

  const onDelete = () => {
    if (!existing) return;
    confirm(() =>
      void run(async () => {
        await deleteEvent(existing.id);
        showToast(t('common.deleted'), undefined, 'warning');
        onClose();
      }),
    );
  };

  const input = (error?: string | null) => inputStyle(error, showErrors);

  return (
    <Sheet
      wide="side"
      onClose={onClose}
      dirty={!readOnly && dirty}
      title={existing ? t('calendar.edit_event') : t('calendar.new_event')}
      subtitle={readOnly ? t('calendar.read_only', { source: sourceLabel }) : undefined}
      footer={
        readOnly ? undefined : (
          <View style={{ gap: spacing.sm }}>
            <FieldError message={failed ? t('common.save_failed') : null} />
            <Button fullWidth icon="check" label={t('common.save')} disabled={busy} onPress={onSave} />
            {existing ? <Button fullWidth variant="ghost" icon="trash-2" label={confirmDelete ? t('tasks.delete_confirm') : t('common.delete')} disabled={busy} onPress={onDelete} /> : null}
          </View>
        )
      }
    >
      <ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={{ padding: spacing.xl, gap: spacing.xl }}>
        <View style={{ gap: spacing.sm }}>
          <TextInput
            autoFocus={!existing}
            editable={!readOnly}
            value={title}
            onChangeText={setTitle}
            placeholder={t('calendar.title_placeholder')}
            placeholderTextColor={colors.textTertiary}
            accessibilityLabel={t('calendar.title_placeholder')}
            style={[input(errors.title), { fontSize: typography.heading.fontSize, fontFamily: fontFamily.semibold, minHeight: 52 }]}
          />
          <FieldError message={showErrors ? errors.title : null} />
        </View>

        <Field label={t('task.date')} icon="calendar">
          {readOnly ? null : (
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm }}>
              {quickDates.map((q) => (
                <Chip key={q.key} label={t(`tasks.date_${q.key}`)} selected={date === q.value} onPress={() => setDate(q.value)} />
              ))}
            </View>
          )}
          <DateField value={date} onChange={setDate} invalid={showErrors && !!errors.date} disabled={readOnly} />
          <FieldError message={showErrors ? errors.date : null} />
        </Field>

        <Field label={t('tasks.time')} icon="clock">
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.md, minHeight: 44 }}>
            <Text variant="bodySm" style={{ flex: 1 }}>{t('calendar.all_day')}</Text>
            <Toggle value={allDay} onValueChange={setAllDay} label={t('calendar.all_day')} disabled={readOnly} />
          </View>
          {!allDay ? (
            <TimeRangeField start={startTime} end={endTime} onChangeStart={setStartTime} onChangeEnd={setEndTime} invalid={showErrors && !!errors.time} disabled={readOnly} />
          ) : null}
          <FieldError message={showErrors ? errors.time : null} />
        </Field>

        {readOnly ? null : (
          <>
            <Field label={t('remind.title')} icon="bell">
              <ReminderChips value={remindBefore} onChange={setRemindBefore} timed={!allDay} />
              {remindBefore !== null && Platform.OS === 'web' ? <Text variant="caption" color="textTertiary">{t('remind.no_web')}</Text> : null}
            </Field>
            <Field label={t('repeat.title')} icon="repeat">
              <RepeatChips value={repeat} onChange={setRepeat} />
              {repeat && existing ? <Text variant="caption" color="textTertiary">{t('repeat.event_hint')}</Text> : null}
            </Field>
          </>
        )}

        <Field label={t('calendar.location')} icon="map-pin">
          <TextInput editable={!readOnly} value={location} onChangeText={setLocation} placeholder={t('calendar.location_placeholder')} placeholderTextColor={colors.textTertiary} accessibilityLabel={t('calendar.location')} style={input()} />
        </Field>

        <Field label={t('calendar.with')} icon="user">
          <TextInput editable={!readOnly} value={person} onChangeText={setPerson} placeholder={t('calendar.with_placeholder')} placeholderTextColor={colors.textTertiary} accessibilityLabel={t('calendar.with')} style={input()} />
          <Text variant="caption" color="textTertiary">{t('calendar.with_hint')}</Text>
        </Field>

        {existing ? <RelatedSection self={{ type: 'event', id: existing.id }} types={['task', 'note', 'transaction']} /> : null}
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
        <Text variant="heading" align="center">{t('calendar.not_found')}</Text>
        <Text variant="bodySm" color="textSecondary" align="center">{t('tasks.not_found_body')}</Text>
        <Button label={t('common.close')} variant="secondary" onPress={onClose} />
      </View>
    </Sheet>
  );
}
