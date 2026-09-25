import { router, useLocalSearchParams } from 'expo-router';
import { useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ScrollView, TextInput, View } from 'react-native';

import { Mascot } from '@/components/brand/mascot';
import { Button, Chip, Field, FieldError, Sheet, Text, Toggle } from '@/components/ui';
import type { CalendarEvent } from '@/db';
import { eventToItem, fromMinutes, toMinutes } from '@/features/calendar/model';
import { createEvent, deleteEvent, updateEvent, useEvent, type EventFormValues } from '@/features/calendar/queries';
import { PrepMeetingSection } from '@/features/ai/components/prep-meeting-section';
import { useCalendarAccounts } from '@/features/google-calendar';
import { RelatedSection } from '@/features/links/components/related-section';
import { isValidDate, isValidTime } from '@/features/tasks/model';
import { addDays, toDateKey } from '@/lib/date';
import { useAsyncAction } from '@/lib/use-async-action';
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
  const { colors, tints, spacing, radius, typography, fontFamily } = useTheme();
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
  const [showErrors, setShowErrors] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const { busy, failed, run } = useAsyncAction();
  const readOnly = !!existing && existing.source !== 'veyra';
  const account = useCalendarAccounts().find((a) => a.id === existing?.accountId);
  const sourceLabel = existing?.source === 'google' ? ['Google', account?.email, existing.calendarName !== account?.email ? existing.calendarName : null].filter(Boolean).join(' · ') : existing?.source;

  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => () => {
    if (timer.current) clearTimeout(timer.current);
  }, []);

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
    const values: EventFormValues = { title: title.trim(), date, allDay, startTime, endTime, location: location.trim() || null, contactName: person.trim() || null };
    void run(async () => {
      if (existing) await updateEvent(existing.id, values);
      else await createEvent(values);
      onClose();
    });
  };

  const onDelete = () => {
    if (!existing) return;
    if (!confirmDelete) {
      setConfirmDelete(true);
      timer.current = setTimeout(() => setConfirmDelete(false), 4000);
      return;
    }
    void run(async () => {
      await deleteEvent(existing.id);
      onClose();
    });
  };

  const input = (error?: string | null) => ({
    backgroundColor: colors.surfaceMuted,
    color: colors.text,
    borderRadius: radius.md,
    paddingHorizontal: spacing.md,
    minHeight: 44,
    minWidth: 0,
    borderWidth: 1.5,
    borderColor: showErrors && error ? tints.priorityHigh.fg : colors.border,
    fontSize: typography.body.fontSize,
    fontFamily: fontFamily.regular,
  });

  return (
    <Sheet
      wide="side"
      onClose={onClose}
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
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm }}>
            {quickDates.map((q) => (
              <Chip key={q.key} label={t(`tasks.date_${q.key}`)} selected={date === q.value} onPress={() => !readOnly && setDate(q.value)} />
            ))}
          </View>
          <TextInput editable={!readOnly} value={date} onChangeText={setDate} placeholder="YYYY-MM-DD" placeholderTextColor={colors.textTertiary} accessibilityLabel={t('task.date')} style={input(errors.date)} />
          <FieldError message={showErrors ? errors.date : null} />
        </Field>

        <Field label={t('tasks.time')} icon="clock">
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.md, minHeight: 44 }}>
            <Text variant="bodySm" style={{ flex: 1 }}>{t('calendar.all_day')}</Text>
            <Toggle value={allDay} onValueChange={setAllDay} label={t('calendar.all_day')} disabled={readOnly} />
          </View>
          {!allDay ? (
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.sm }}>
              <TextInput editable={!readOnly} value={startTime} onChangeText={setStartTime} placeholder="09:00" placeholderTextColor={colors.textTertiary} accessibilityLabel={t('task.start_time')} style={[input(errors.time), { flex: 1 }]} />
              <Text color="textTertiary">–</Text>
              <TextInput editable={!readOnly} value={endTime} onChangeText={setEndTime} placeholder="10:00" placeholderTextColor={colors.textTertiary} accessibilityLabel={t('task.end_time')} style={[input(errors.time), { flex: 1 }]} />
            </View>
          ) : null}
          <FieldError message={showErrors ? errors.time : null} />
        </Field>

        <Field label={t('calendar.location')} icon="map-pin">
          <TextInput editable={!readOnly} value={location} onChangeText={setLocation} placeholder={t('calendar.location_placeholder')} placeholderTextColor={colors.textTertiary} accessibilityLabel={t('calendar.location')} style={input()} />
        </Field>

        <Field label={t('calendar.with')} icon="user">
          <TextInput editable={!readOnly} value={person} onChangeText={setPerson} placeholder={t('calendar.with_placeholder')} placeholderTextColor={colors.textTertiary} accessibilityLabel={t('calendar.with')} style={input()} />
          <Text variant="caption" color="textTertiary">{t('calendar.with_hint')}</Text>
        </Field>

        {existing ? <RelatedSection self={{ type: 'event', id: existing.id }} types={['task', 'note', 'transaction']} /> : null}
        {existing ? <PrepMeetingSection event={existing} /> : null}
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
