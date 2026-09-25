import { router } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { View } from 'react-native';

import { Button, Icon, IconButton, PressableScale, Tag, Text, type IconName } from '@/components/ui';
import { describe, typeStyle } from '@/features/capture/detected-item';
import { formatMoney } from '@/lib/currency';
import { daysFromToday } from '@/lib/date';
import { useTheme } from '@/theme';

import type { Card, ListRow, Proposal } from '../types';

type ProposalCard = Extract<Card, { type: 'proposal' }>;

export function CardView({ card, busy, onConfirm, onDismiss, onEdit }: { card: Card; busy?: boolean; onConfirm: (c: ProposalCard) => void; onDismiss: (c: ProposalCard) => void; onEdit?: (c: ProposalCard, proposal: Proposal) => void }) {
  if (card.type === 'list') return <ListCard title={card.title} rows={card.rows} />;
  if (card.type === 'stats') return <StatsCard rows={card.rows} />;
  if (card.proposal.kind === 'apply_plan') return <PlanView card={card} plan={card.proposal} busy={!!busy} onConfirm={() => onConfirm(card)} onDismiss={() => onDismiss(card)} onEdit={(p) => onEdit?.(card, p)} />;
  return <ProposalView card={card} busy={!!busy} onConfirm={() => onConfirm(card)} onDismiss={() => onDismiss(card)} />;
}

const rowIcon: Record<ListRow['kind'], IconName> = { task: 'check-square', event: 'calendar', bill: 'file-text' };

function ListCard({ title, rows }: { title?: string; rows: ListRow[] }) {
  const { colors, tints, spacing, radius } = useTheme();
  const open = (r: ListRow) => router.push({ pathname: r.kind === 'task' ? '/task/[id]' : r.kind === 'event' ? '/event/[id]' : '/bill/[id]', params: { id: r.id } });
  return (
    <View style={{ borderRadius: radius.lg, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.surface, paddingVertical: spacing.xs }}>
      {title ? <Text variant="overline" color="textSecondary" style={{ paddingHorizontal: spacing.md, paddingTop: spacing.sm }}>{title.toUpperCase()}</Text> : null}
      {rows.map((r, i) => {
        const tone = r.tone === 'danger' ? tints.priorityHigh.fg : r.tone === 'warning' ? tints.priorityMedium.fg : undefined;
        return (
          <PressableScale
            key={`${r.kind}${r.id}`}
            accessibilityRole="button"
            accessibilityLabel={`${r.title}${r.meta ? `, ${r.meta}` : ''}`}
            onPress={() => open(r)}
            style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.md, minHeight: 48, paddingHorizontal: spacing.md, borderTopWidth: i ? 1 : 0, borderTopColor: colors.border, opacity: r.tone === 'muted' ? 0.55 : 1 }}
          >
            <Icon name={rowIcon[r.kind]} size={16} tone={tone ?? colors.textSecondary} />
            <View style={{ flex: 1, paddingVertical: spacing.sm }}>
              <Text variant="label" numberOfLines={1}>{r.title}</Text>
              {r.meta ? <Text variant="caption" tone={tone ?? colors.textSecondary}>{r.meta}</Text> : null}
            </View>
            <Icon name="chevron-right" size={16} color="textTertiary" />
          </PressableScale>
        );
      })}
    </View>
  );
}

function StatsCard({ rows }: { rows: Extract<Card, { type: 'stats' }>['rows'] }) {
  const { colors, tints, spacing, radius } = useTheme();
  return (
    <View style={{ borderRadius: radius.lg, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.surface, padding: spacing.md, gap: spacing.sm }}>
      {rows.map((r) => {
        const tone = r.tone === 'danger' ? tints.priorityHigh.fg : r.tone === 'warning' ? tints.priorityMedium.fg : r.tone === 'good' ? tints.done.fg : undefined;
        return (
          <View key={r.label} style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.sm }}>
            <View style={{ flex: 1 }}>
              <Text variant="label">{r.label}</Text>
              {r.hint ? <Text variant="caption" color="textSecondary">{r.hint}</Text> : null}
            </View>
            {r.tone === 'danger' || r.tone === 'warning' ? <Icon name={r.tone === 'danger' ? 'alert-octagon' : 'alert-triangle'} size={14} tone={tone} /> : null}
            <Text variant="label" weight="semibold" tone={tone ?? colors.text} style={{ fontVariant: ['tabular-nums'] }}>{r.value}</Text>
          </View>
        );
      })}
    </View>
  );
}

/** What a proposal would do, in words. */
function useProposalLines(p: Proposal): { icon: IconName; tint: string; bg: string; label: string; title: string; detail?: string }[] {
  const { t, i18n } = useTranslation();
  const { tints } = useTheme();
  const when = (date: string, start?: string, end?: string) => {
    const d = daysFromToday(date);
    const day = d === 0 ? t('capture.today') : d === 1 ? t('capture.tomorrow') : new Date(`${date}T00:00:00`).toLocaleDateString(i18n.language === 'th' ? 'th-TH' : 'en-GB', { weekday: 'short', day: 'numeric', month: 'short' });
    return start ? `${day} · ${start}${end ? `–${end}` : ''}` : day;
  };
  switch (p.kind) {
    case 'create':
      return p.items.map((item) => {
        const s = typeStyle[item.type];
        const d = describe(item, t, i18n.language);
        return { icon: s.icon, tint: tints[s.tint].fg, bg: tints[s.tint].bg, label: t(`assistant.p.add_${item.type}`), ...d };
      });
    case 'complete_task':
      return [{ icon: 'check-circle', tint: tints.done.fg, bg: tints.done.bg, label: t('assistant.p.complete'), title: p.title }];
    case 'reschedule_task':
      return [{ icon: 'clock', tint: tints.meeting.fg, bg: tints.meeting.bg, label: p.startTime ? t('assistant.p.schedule') : t('assistant.p.move'), title: p.title, detail: when(p.date, p.startTime, p.endTime) }];
    case 'pay_bill':
      return [{ icon: 'credit-card', tint: tints.bill.fg, bg: tints.bill.bg, label: t('assistant.p.pay'), title: p.name, detail: formatMoney(p.amount, p.currency, 'en-GB') }];
    case 'apply_plan':
      return [{ icon: 'sun', tint: tints.meeting.fg, bg: tints.meeting.bg, label: t('assistant.p.plan', { day: when(p.date) }), title: t('assistant.plan.blocks', { count: p.slots.length }) }];
  }
}

type PlanProposal = Extract<Proposal, { kind: 'apply_plan' }>;

/**
 * A whole day laid out by the planner (P3-02 approve flow). While pending, each row has a remove button
 * so the user can trim the plan; Confirm moves every remaining task, Not now leaves everything as is.
 */
function PlanView({ card, plan, busy, onConfirm, onDismiss, onEdit }: { card: ProposalCard; plan: PlanProposal; busy: boolean; onConfirm: () => void; onDismiss: () => void; onEdit: (p: PlanProposal) => void }) {
  const { t, i18n } = useTranslation();
  const { colors, tints, spacing, radius } = useTheme();
  const pending = card.state === 'pending';
  const d = daysFromToday(plan.date);
  const day = d === 0 ? t('capture.today') : d === 1 ? t('capture.tomorrow') : new Date(`${plan.date}T00:00:00`).toLocaleDateString(i18n.language === 'th' ? 'th-TH' : 'en-GB', { weekday: 'short', day: 'numeric', month: 'short' });
  const remove = (taskId: string) => onEdit({ ...plan, slots: plan.slots.filter((s) => s.taskId !== taskId) });
  const open = (taskId: string) => router.push({ pathname: '/task/[id]', params: { id: taskId } });

  return (
    <View style={{ borderRadius: radius.lg, borderWidth: 1.5, borderColor: pending ? colors.primary : colors.border, backgroundColor: colors.surface, paddingVertical: spacing.md, gap: spacing.sm, opacity: card.state === 'dismissed' ? 0.6 : 1 }}>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.md, paddingHorizontal: spacing.md }}>
        <View style={{ width: 36, height: 36, borderRadius: 10, backgroundColor: tints.meeting.bg, alignItems: 'center', justifyContent: 'center' }}>
          <Icon name="sun" size={16} tone={tints.meeting.fg} />
        </View>
        <View style={{ flex: 1, gap: 1 }}>
          <Text variant="overline" tone={tints.meeting.fg}>{t('assistant.p.plan', { day }).toUpperCase()}</Text>
          <Text variant="label" weight="semibold">{plan.slots.length ? t('assistant.plan.blocks', { count: plan.slots.length }) : t('assistant.plan.empty')}</Text>
        </View>
      </View>

      <View>
        {plan.slots.map((s, i) => (
          <View key={s.taskId} style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.sm, minHeight: 52, paddingLeft: spacing.md, paddingRight: spacing.xs, borderTopWidth: 1, borderTopColor: colors.border, borderBottomWidth: i === plan.slots.length - 1 ? 1 : 0, borderBottomColor: colors.border }}>
            <Text variant="caption" weight="semibold" color="textSecondary" style={{ width: 92, fontVariant: ['tabular-nums'] }}>{s.startTime}–{s.endTime}</Text>
            <PressableScale accessibilityRole="button" accessibilityLabel={s.title} onPress={() => open(s.taskId)} style={{ flex: 1, paddingVertical: spacing.sm, gap: 1 }}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.xs }}>
                <Text variant="label" numberOfLines={1} style={{ flexShrink: 1 }}>{s.title}</Text>
                {s.overdue ? <Tag label={t('assistant.plan.overdue')} tint="priorityHigh" /> : null}
              </View>
              {s.reason ? <Text variant="caption" color="textSecondary" numberOfLines={2}>{s.reason}</Text> : null}
            </PressableScale>
            {pending && !busy ? <IconButton icon="x" label={t('assistant.plan.remove', { title: s.title })} onPress={() => remove(s.taskId)} /> : null}
          </View>
        ))}
      </View>

      {plan.skipped.length ? (
        <View style={{ paddingHorizontal: spacing.md, gap: 2 }}>
          <Text variant="overline" color="textTertiary">{t('assistant.plan.skipped').toUpperCase()}</Text>
          {plan.skipped.slice(0, 4).map((s) => (
            <Text key={s.taskId} variant="caption" color="textSecondary" numberOfLines={1}>
              {s.title}
              {s.reason ? ` · ${s.reason}` : ''}
            </Text>
          ))}
        </View>
      ) : null}

      <View style={{ paddingHorizontal: spacing.md }}>
        {pending ? (
          <View style={{ flexDirection: 'row', gap: spacing.sm, flexWrap: 'wrap' }}>
            <Button size="sm" icon="check" label={t('assistant.plan.approve', { count: plan.slots.length })} onPress={onConfirm} disabled={busy || !plan.slots.length} />
            <Button size="sm" variant="ghost" label={t('home.ai_not_now')} onPress={onDismiss} disabled={busy} />
          </View>
        ) : (
          <View accessibilityLiveRegion="polite">
            {card.state === 'done' ? <Tag label={t('assistant.done')} tint="done" icon="check" /> : card.state === 'failed' ? <Tag label={t('assistant.failed')} tint="priorityHigh" icon="alert-circle" /> : <Text variant="caption" color="textTertiary">{t('assistant.dismissed')}</Text>}
          </View>
        )}
      </View>
    </View>
  );
}

function ProposalView({ card, busy, onConfirm, onDismiss }: { card: ProposalCard; busy: boolean; onConfirm: () => void; onDismiss: () => void }) {
  const { t } = useTranslation();
  const { colors, spacing, radius } = useTheme();
  const lines = useProposalLines(card.proposal);
  const pending = card.state === 'pending';
  return (
    <View style={{ borderRadius: radius.lg, borderWidth: 1.5, borderColor: pending ? colors.primary : colors.border, backgroundColor: colors.surface, padding: spacing.md, gap: spacing.md, opacity: card.state === 'dismissed' ? 0.6 : 1 }}>
      {lines.map((l, i) => (
        <View key={i} style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.md }}>
          <View style={{ width: 36, height: 36, borderRadius: 10, backgroundColor: l.bg, alignItems: 'center', justifyContent: 'center' }}>
            <Icon name={l.icon} size={16} tone={l.tint} />
          </View>
          <View style={{ flex: 1, gap: 1 }}>
            <Text variant="overline" tone={l.tint}>{l.label.toUpperCase()}</Text>
            <Text variant="label" weight="semibold" numberOfLines={2}>{l.title}</Text>
            {l.detail ? <Text variant="caption" color="textSecondary" numberOfLines={2}>{l.detail}</Text> : null}
          </View>
        </View>
      ))}
      {pending ? (
        <View style={{ flexDirection: 'row', gap: spacing.sm, flexWrap: 'wrap' }}>
          <Button size="sm" icon="check" label={t('assistant.confirm')} onPress={onConfirm} disabled={busy} />
          <Button size="sm" variant="ghost" label={t('home.ai_not_now')} onPress={onDismiss} disabled={busy} />
        </View>
      ) : (
        <View accessibilityLiveRegion="polite">
          {card.state === 'done' ? <Tag label={t('assistant.done')} tint="done" icon="check" /> : card.state === 'failed' ? <Tag label={t('assistant.failed')} tint="priorityHigh" icon="alert-circle" /> : <Text variant="caption" color="textTertiary">{t('assistant.dismissed')}</Text>}
        </View>
      )}
    </View>
  );
}
