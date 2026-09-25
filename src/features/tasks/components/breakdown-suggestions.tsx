import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { View } from 'react-native';
import Animated, { FadeIn, FadeInDown } from 'react-native-reanimated';

import { Gradient, Icon, IconButton, PressableScale, Text } from '@/components/ui';
import { breakdownRemote, breakdownRemoteEnabled } from '@/features/ai/breakdown';
import { newId } from '@/lib/ids';
import { useTheme } from '@/theme';

import type { ChecklistItem } from '../queries';

type Phase = { kind: 'idle' } | { kind: 'loading' } | { kind: 'ready'; texts: string[] } | { kind: 'empty' } | { kind: 'error' };

type Props = {
  title: string;
  notes: string;
  existing: ChecklistItem[];
  onAdd: (items: ChecklistItem[]) => void;
};

/**
 * "Break down with AI" (SPEC §6.4 `ai-breakdown`, ROADMAP P3-03) — turns a task title into a few
 * suggested checklist steps. Nothing is written to the checklist until the user reviews and taps Add;
 * from there it's just local form state like every other field, saved with the rest of the task.
 */
export function BreakdownSuggestions({ title, notes, existing, onAdd }: Props) {
  const { t, i18n } = useTranslation();
  const { colors, spacing, radius } = useTheme();
  const [phase, setPhase] = useState<Phase>({ kind: 'idle' });
  const [excluded, setExcluded] = useState<Set<number>>(new Set());

  if (!breakdownRemoteEnabled || !title.trim()) return null;

  const run = async () => {
    setPhase({ kind: 'loading' });
    setExcluded(new Set());
    try {
      const res = await breakdownRemote(title.trim(), {
        notes: notes.trim() || undefined,
        locale: i18n.language === 'th' ? 'th' : 'en',
        existing: existing.map((c) => c.text),
      });
      setPhase(res.subtasks.length ? { kind: 'ready', texts: res.subtasks.map((s) => s.text) } : { kind: 'empty' });
    } catch {
      setPhase({ kind: 'error' });
    }
  };

  const toggle = (i: number) =>
    setExcluded((prev) => {
      const next = new Set(prev);
      if (next.has(i)) next.delete(i);
      else next.add(i);
      return next;
    });

  const add = () => {
    if (phase.kind !== 'ready') return;
    const items = phase.texts.filter((_, i) => !excluded.has(i)).map((text) => ({ id: newId(), text, done: false }));
    if (items.length) onAdd(items);
    setPhase({ kind: 'idle' });
  };

  if (phase.kind === 'idle') {
    return (
      <PressableScale
        accessibilityRole="button"
        accessibilityLabel={t('task.breakdown_cta')}
        onPress={() => void run()}
        style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.sm, minHeight: 44, alignSelf: 'flex-start' }}
      >
        <Gradient variant="ai" style={{ width: 8, height: 8, borderRadius: 4 }} />
        <Text variant="label" weight="semibold" color="primary">{t('task.breakdown_cta')}</Text>
      </PressableScale>
    );
  }

  const selectedCount = phase.kind === 'ready' ? phase.texts.length - excluded.size : 0;

  return (
    <Animated.View entering={FadeIn.duration(150)} style={{ gap: spacing.sm, backgroundColor: colors.aiWash, borderRadius: radius.lg, padding: spacing.md }}>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.sm }}>
        <Gradient variant="ai" style={{ width: 8, height: 8, borderRadius: 4 }} />
        <Text variant="overline" color="primary" style={{ flex: 1 }}>{t('task.breakdown_title').toUpperCase()}</Text>
        <IconButton icon="x" label={t('common.close')} onPress={() => setPhase({ kind: 'idle' })} />
      </View>

      {phase.kind === 'loading' ? <Text variant="bodySm" color="textSecondary">{t('capture.thinking')}</Text> : null}
      {phase.kind === 'empty' ? <Text variant="bodySm" color="textSecondary">{t('task.breakdown_empty')}</Text> : null}

      {phase.kind === 'error' ? (
        <View style={{ gap: spacing.sm, alignItems: 'flex-start' }}>
          <Text variant="bodySm" color="textSecondary">{t('task.breakdown_error')}</Text>
          <PressableScale accessibilityRole="button" onPress={() => void run()} style={{ minHeight: 32, justifyContent: 'center' }}>
            <Text variant="label" weight="semibold" color="primary">{t('capture.try_again')}</Text>
          </PressableScale>
        </View>
      ) : null}

      {phase.kind === 'ready' ? (
        <>
          {phase.texts.map((text, i) => {
            const included = !excluded.has(i);
            return (
              <Animated.View key={i} entering={FadeInDown.duration(120)}>
                <PressableScale
                  accessibilityRole="checkbox"
                  accessibilityState={{ checked: included }}
                  accessibilityLabel={text}
                  onPress={() => toggle(i)}
                  style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.sm, minHeight: 40 }}
                >
                  <View
                    style={{
                      width: 20,
                      height: 20,
                      borderRadius: 6,
                      borderWidth: 2,
                      borderColor: included ? colors.primary : colors.borderStrong,
                      backgroundColor: included ? colors.primary : 'transparent',
                      alignItems: 'center',
                      justifyContent: 'center',
                    }}
                  >
                    {included ? <Icon name="check" size={12} tone={colors.onPrimary} /> : null}
                  </View>
                  <Text variant="body" color={included ? 'text' : 'textTertiary'} style={{ flex: 1 }}>{text}</Text>
                </PressableScale>
              </Animated.View>
            );
          })}
          <PressableScale
            accessibilityRole="button"
            disabled={!selectedCount}
            onPress={add}
            style={{ minHeight: 40, justifyContent: 'center', alignSelf: 'flex-start', opacity: selectedCount ? 1 : 0.5 }}
          >
            <Text variant="label" weight="semibold" color="primary">{t('task.breakdown_add', { count: selectedCount })}</Text>
          </PressableScale>
        </>
      ) : null}
    </Animated.View>
  );
}
