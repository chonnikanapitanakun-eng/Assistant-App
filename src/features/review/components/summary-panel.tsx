import { router } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { ActivityIndicator, View } from 'react-native';
import Animated, { FadeIn } from 'react-native-reanimated';

import { Mascot } from '@/components/brand/mascot';
import { Button, Card, Gradient, Icon, IconButton, Tag, Text, type IconName } from '@/components/ui';
import type { SummaryScope } from '@/features/ai/summary';
import { summaryRemoteEnabled } from '@/features/ai/summary';
import { fromDateKey } from '@/features/calendar/model';
import { useSummary } from '@/features/review/use-summary';
import { useTheme } from '@/theme';

/** Daily / weekly written review: Claude's summary when configured, the rule-based one otherwise (P2-02). */
export function SummaryPanel({ scope }: { scope: SummaryScope }) {
  const { t, i18n } = useTranslation();
  const { colors, spacing, radius } = useTheme();
  const { request, review, source, status, generatedAt, refresh } = useSummary(scope);

  const lang = i18n.language === 'th' ? 'th-TH' : 'en-GB';
  const day = (key: string, opts: Intl.DateTimeFormatOptions) => fromDateKey(key).toLocaleDateString(lang, opts);
  const range = scope === 'day' ? day(request.from, { weekday: 'long', day: 'numeric', month: 'long' }) : `${day(request.from, { day: 'numeric', month: 'short' })} – ${day(request.to, { day: 'numeric', month: 'short' })}`;

  return (
    <>
      <Gradient style={{ borderRadius: radius.panel, padding: 1.5 }}>
        <View style={{ backgroundColor: colors.surface, borderRadius: radius.panel - 1.5, padding: spacing.xl, gap: spacing.lg }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.md }}>
            <Mascot pose={status === 'loading' ? 'thinking' : review.needsAttention.length ? 'idea' : 'happy'} size={56} />
            <View style={{ flex: 1, gap: 2 }}>
              <Text variant="overline" color="textSecondary">{range.toUpperCase()}</Text>
              <Text variant="heading">{review.headline}</Text>
            </View>
            <IconButton icon="refresh-cw" label={t('review.refresh')} onPress={refresh} />
          </View>
          <Animated.View key={`${scope}-${source}-${generatedAt ?? 0}`} entering={FadeIn.duration(250)}>
            <Text variant="body">{review.summary}</Text>
          </Animated.View>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.sm, flexWrap: 'wrap' }}>
            {status === 'loading' ? (
              <>
                <ActivityIndicator size="small" color={colors.primary} />
                <Text variant="caption" color="textSecondary">{t('review.loading')}</Text>
              </>
            ) : source === 'claude' ? (
              <Tag label={t('review.by_veyra')} tint="focus" icon="zap" />
            ) : (
              <Text variant="caption" color="textTertiary">{summaryRemoteEnabled ? (status === 'error' ? t('review.offline') : t('review.local')) : t('review.local')}</Text>
            )}
            {generatedAt && status !== 'loading' ? (
              <Text variant="caption" color="textTertiary">{t('review.generated_at', { time: new Date(generatedAt).toLocaleTimeString(lang, { hour: '2-digit', minute: '2-digit' }) })}</Text>
            ) : null}
          </View>
        </View>
      </Gradient>

      <Section icon="alert-circle" title={t('review.needs_attention')} items={review.needsAttention} empty={t('review.nothing_pending')} tone="priorityHigh" />
      <Section icon="star" title={t('review.highlights')} items={review.highlights} empty={t('review.no_highlights')} tone="done" />

      <View style={{ flexDirection: 'row', gap: spacing.sm, flexWrap: 'wrap' }}>
        <Button label={t('review.open_tasks')} variant="secondary" size="sm" icon="check-square" onPress={() => router.navigate('/tasks')} />
        <Button label={t('review.open_calendar')} variant="secondary" size="sm" icon="calendar" onPress={() => router.navigate('/calendar')} />
        <Button label={t('review.ask_veyra')} variant="ghost" size="sm" icon="message-circle" onPress={() => router.push({ pathname: '/assistant', params: { q: t(`review.ask_${scope}`) } })} />
      </View>
    </>
  );
}

function Section({ icon, title, items, empty, tone }: { icon: IconName; title: string; items: string[]; empty: string; tone: 'priorityHigh' | 'done' }) {
  const { tints, spacing, radius } = useTheme();
  return (
    <Card>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.sm }}>
        <View style={{ width: 28, height: 28, borderRadius: radius.md, backgroundColor: tints[tone].bg, alignItems: 'center', justifyContent: 'center' }}>
          <Icon name={icon} size={15} tone={tints[tone].fg} />
        </View>
        <Text variant="heading" accessibilityRole="header">{title}</Text>
      </View>
      {items.length ? (
        <View style={{ gap: spacing.sm }}>
          {items.map((line, i) => (
            <View key={i} style={{ flexDirection: 'row', gap: spacing.sm, alignItems: 'flex-start' }}>
              <View style={{ width: 6, height: 6, borderRadius: 3, marginTop: 9, backgroundColor: tints[tone].fg }} />
              <Text variant="bodySm" style={{ flex: 1 }}>{line}</Text>
            </View>
          ))}
        </View>
      ) : (
        <Text variant="bodySm" color="textSecondary">{empty}</Text>
      )}
    </Card>
  );
}
