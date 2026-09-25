import { router } from 'expo-router';
import { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ScrollView, View } from 'react-native';

import { Mascot } from '@/components/brand/mascot';
import { Button, Chip, Gradient, Tag, Text } from '@/components/ui';
import { runProposal } from '@/features/assistant/actions';
import { respond } from '@/features/assistant/engine';
import type { Proposal } from '@/features/assistant/types';
import { useAssistantContext } from '@/features/assistant/use-context';
import { useBreakpoint, useTheme } from '@/theme';

/**
 * Proactive AI card. Offers one concrete, real suggestion (a free slot for the most
 * important unscheduled task) and quick questions that open the chat.
 * Gradient appears only as a hairline frame — calm, not loud.
 */
export function AssistantCard() {
  const { t } = useTranslation();
  const { colors, spacing, radius, shadow } = useTheme();
  const { isMobile } = useBreakpoint();
  const getContext = useAssistantContext();
  const [state, setState] = useState<'idle' | 'done' | 'dismissed'>('idle');

  // Same planner as "Plan my day" in the chat, so Home and chat never disagree.
  const suggestion = useMemo(() => {
    const card = respond('plan my day', getContext(), t).cards.find((c) => c.type === 'proposal');
    if (card?.type !== 'proposal' || card.proposal.kind !== 'apply_plan') return null;
    const [first] = card.proposal.slots;
    const p: Proposal = { kind: 'reschedule_task', taskId: first.taskId, title: first.title, date: card.proposal.date, startTime: first.startTime, endTime: first.endTime };
    return p;
  }, [getContext, t]);

  const accept = async (p: Proposal) => {
    let ok = false;
    try {
      ok = await runProposal(p);
    } catch (e) {
      console.error('Assistant suggestion failed:', e);
    }
    setState(ok ? 'done' : 'dismissed');
  };

  const ask = (q: string) => router.push({ pathname: '/assistant', params: { q } });
  const chips = (
    <>
      <Chip label={t('home.ai_review')} icon="sunrise" onPress={() => router.push('/review')} />
      <Chip label={t('home.ai_plan_day')} icon="sun" onPress={() => ask(t('home.ai_plan_day'))} />
      <Chip label={t('home.ai_summarise')} icon="list" onPress={() => ask(t('home.ai_summarise'))} />
      <Chip label={t('home.ai_overdue')} icon="alert-circle" onPress={() => ask(t('home.ai_overdue'))} />
      <Chip label={t('home.ai_expenses')} icon="pie-chart" onPress={() => ask(t('home.ai_expenses'))} />
    </>
  );

  return (
    <Gradient style={{ borderRadius: radius.panel, padding: 1.5, boxShadow: shadow.md }}>
      <View style={{ backgroundColor: colors.surface, borderRadius: radius.panel - 1.5, padding: spacing.xl, gap: spacing.lg }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.md }}>
          <Mascot pose="wave" size={56} />
          <View style={{ flex: 1 }}>
            <Text variant="overline" color="primary">VEYRA</Text>
            <Text variant="heading">{t('home.ai_title')}</Text>
          </View>
        </View>

        {suggestion && state !== 'dismissed' ? <Suggestion p={suggestion} state={state} onAccept={() => void accept(suggestion)} onDismiss={() => setState('dismissed')} /> : null}

        {isMobile ? (
          // One swipeable row on phones instead of four stacked pills.
          <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginHorizontal: -spacing.xl }} contentContainerStyle={{ gap: spacing.sm, paddingHorizontal: spacing.xl }}>
            {chips}
          </ScrollView>
        ) : (
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm }}>{chips}</View>
        )}
      </View>
    </Gradient>
  );
}

function Suggestion({ p, state, onAccept, onDismiss }: { p: Extract<Proposal, { kind: 'reschedule_task' }>; state: 'idle' | 'done' | 'dismissed'; onAccept: () => void; onDismiss: () => void }) {
  const { t } = useTranslation();
  const { colors, spacing, radius } = useTheme();
  return (
    <View style={{ backgroundColor: colors.aiWash, borderRadius: radius.lg, padding: spacing.lg, gap: spacing.md }}>
      <Text variant="bodySm">{t('home.ai_slot', { title: p.title, start: p.startTime, end: p.endTime })}</Text>
      {state === 'done' ? (
        <View accessibilityLiveRegion="polite">
          <Tag label={t('home.ai_scheduled', { start: p.startTime })} tint="done" icon="check" />
        </View>
      ) : (
        <View style={{ flexDirection: 'row', gap: spacing.sm, flexWrap: 'wrap' }}>
          <Button label={t('home.ai_accept')} size="sm" icon="calendar" onPress={onAccept} />
          <Button label={t('home.ai_not_now')} size="sm" variant="ghost" onPress={onDismiss} />
        </View>
      )}
    </View>
  );
}
