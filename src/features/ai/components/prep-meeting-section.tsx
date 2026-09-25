import { router } from 'expo-router';
import { useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ActivityIndicator, View } from 'react-native';
import Animated, { FadeIn } from 'react-native-reanimated';

import { Button, Field, Icon, Text } from '@/components/ui';
import type { CalendarEvent } from '@/db';
import { useAsyncAction } from '@/lib/use-async-action';
import { useTheme } from '@/theme';

import { buildPrepRequest, isEmptyPrep, prepMeetingEnabled, prepMeetingRemote, savePrepAsTask } from '../prep-meeting';
import type { PrepMeetingResponse } from '../types';

type Phase = { kind: 'idle' } | { kind: 'loading' } | { kind: 'ready'; prep: PrepMeetingResponse } | { kind: 'empty' } | { kind: 'error' };

/**
 * "เตรียมนัด" — asks Claude for a brief / checklist / agenda built from the records linked to this event
 * (features/ai/prep-meeting.ts). Read-only until the user taps "Save as task"; nothing is written before that.
 * Render only for saved events.
 */
export function PrepMeetingSection({ event }: { event: CalendarEvent }) {
  const { t, i18n } = useTranslation();
  const { spacing, colors, radius, tints } = useTheme();
  const [phase, setPhase] = useState<Phase>({ kind: 'idle' });
  const [savedTaskId, setSavedTaskId] = useState<string | null>(null);
  const abortRef = useRef<AbortController | null>(null);
  const { busy, failed, run } = useAsyncAction();

  useEffect(() => () => abortRef.current?.abort(), []);

  if (!prepMeetingEnabled) return null;

  const prepare = async () => {
    abortRef.current?.abort();
    const controller = new AbortController();
    abortRef.current = controller;
    setPhase({ kind: 'loading' });
    setSavedTaskId(null);
    try {
      const req = await buildPrepRequest(event, i18n.language.startsWith('th') ? 'th' : 'en');
      const prep = await prepMeetingRemote(req, controller.signal);
      if (controller.signal.aborted) return;
      setPhase(isEmptyPrep(prep) ? { kind: 'empty' } : { kind: 'ready', prep });
    } catch (e) {
      if (controller.signal.aborted) return;
      console.error('Prep meeting failed:', e);
      setPhase({ kind: 'error' });
    }
  };

  const save = (prep: PrepMeetingResponse) =>
    void run(async () => {
      const id = await savePrepAsTask(event, prep, t('prep.task_title', { title: event.title }), t('prep.agenda'));
      setSavedTaskId(id);
    });

  const tint = tints.meeting;

  return (
    <Field label={t('prep.title')} icon="zap">
      {phase.kind === 'idle' ? (
        <View style={{ gap: spacing.sm }}>
          <Text variant="bodySm" color="textTertiary">{t('prep.hint')}</Text>
          <View style={{ flexDirection: 'row' }}>
            <Button variant="secondary" size="sm" icon="zap" label={t('prep.prepare')} onPress={() => void prepare()} />
          </View>
        </View>
      ) : null}

      {phase.kind === 'loading' ? (
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.sm, minHeight: 44 }}>
          <ActivityIndicator color={colors.primary} />
          <Text variant="bodySm" color="textSecondary">{t('prep.thinking')}</Text>
        </View>
      ) : null}

      {phase.kind === 'error' || phase.kind === 'empty' ? (
        <View style={{ gap: spacing.sm }}>
          <Text variant="bodySm" color="textSecondary">{t(phase.kind === 'error' ? 'prep.error' : 'prep.empty')}</Text>
          <View style={{ flexDirection: 'row' }}>
            <Button variant="secondary" size="sm" icon="refresh-cw" label={t('prep.retry')} onPress={() => void prepare()} />
          </View>
        </View>
      ) : null}

      {phase.kind === 'ready' ? (
        <Animated.View entering={FadeIn.duration(200)} style={{ gap: spacing.md }}>
          {phase.prep.brief ? (
            <View style={{ gap: spacing.xs, padding: spacing.md, borderRadius: radius.lg, backgroundColor: tint.bg }}>
              {phase.prep.brief.split(/\n{2,}/).map((p, i) => (
                <Text key={i} variant="bodySm" tone={tint.fg}>{p}</Text>
              ))}
            </View>
          ) : null}

          {phase.prep.checklist.length ? (
            <List heading={t('prep.checklist')} icon="check-square" items={phase.prep.checklist} />
          ) : null}
          {phase.prep.agenda.length ? (
            <List heading={t('prep.agenda')} icon="list" items={phase.prep.agenda} numbered />
          ) : null}

          <Text variant="caption" color="textTertiary">{t('prep.by_claude')}</Text>

          {savedTaskId ? (
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.sm, flexWrap: 'wrap' }}>
              <Icon name="check-circle" size={16} tone={tints.priorityLow.fg} />
              <Text variant="bodySm" color="textSecondary" style={{ flex: 1 }}>{t('prep.saved')}</Text>
              <Button variant="ghost" size="sm" icon="arrow-right" label={t('prep.open_task')} onPress={() => router.push({ pathname: '/task/[id]', params: { id: savedTaskId } })} />
            </View>
          ) : (
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm }}>
              {phase.prep.checklist.length || phase.prep.agenda.length ? (
                <Button size="sm" icon="plus" label={t('prep.save_task')} disabled={busy} onPress={() => save(phase.prep)} />
              ) : null}
              <Button variant="ghost" size="sm" icon="refresh-cw" label={t('prep.retry')} disabled={busy} onPress={() => void prepare()} />
            </View>
          )}
          {failed ? <Text variant="caption" tone={tints.priorityHigh.fg}>{t('common.save_failed')}</Text> : null}
        </Animated.View>
      ) : null}
    </Field>
  );
}

function List({ heading, icon, items, numbered }: { heading: string; icon: 'check-square' | 'list'; items: string[]; numbered?: boolean }) {
  const { spacing, colors, radius } = useTheme();
  return (
    <View style={{ gap: spacing.xs, padding: spacing.md, borderRadius: radius.lg, backgroundColor: colors.surfaceMuted }}>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.xs }}>
        <Icon name={icon} size={14} color="textSecondary" />
        <Text variant="caption" color="textSecondary" weight="semibold">{heading}</Text>
      </View>
      {items.map((line, i) => (
        <View key={i} style={{ flexDirection: 'row', gap: spacing.sm }}>
          <Text variant="bodySm" color="textTertiary" style={{ width: 18 }}>{numbered ? `${i + 1}.` : '☐'}</Text>
          <Text variant="bodySm" style={{ flex: 1 }}>{line}</Text>
        </View>
      ))}
    </View>
  );
}
