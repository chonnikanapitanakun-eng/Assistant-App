import { router } from 'expo-router';
import { useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { View } from 'react-native';
import Animated, { FadeIn } from 'react-native-reanimated';

import { Mascot } from '@/components/brand/mascot';
import { Button, Card, Icon, IconButton, PressableScale, Screen, Text, Toggle } from '@/components/ui';
import type { Routine } from '@/db';
import { periodIcon, ruleLabel } from '@/features/routines/labels';
import { PERIODS, sortRoutines } from '@/features/routines/model';
import { setRoutineActive, useRoutines } from '@/features/routines/queries';
import { background } from '@/lib/background';
import { useTheme } from '@/theme';

export default function RoutinesScreen() {
  const { t } = useTranslation();
  const { colors, spacing, motion } = useTheme();
  const routines = useRoutines();
  const back = () => (router.canGoBack() ? router.back() : router.replace('/tasks'));
  const open = (id: string) => router.push({ pathname: '/routine/[id]', params: { id } });

  const groups = useMemo(() => {
    const sorted = sortRoutines(routines);
    return [...PERIODS, null].map((period) => ({ period, items: sorted.filter((r) => r.period === period) })).filter((g) => g.items.length);
  }, [routines]);

  return (
    <Screen maxWidth={720}>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.sm, marginLeft: -spacing.sm }}>
        <IconButton icon="chevron-left" label={t('common.back')} onPress={back} />
        <Text variant="title" accessibilityRole="header" style={{ flex: 1 }}>{t('routines.title')}</Text>
        <IconButton icon="plus" label={t('routines.add')} color="primary" filled onPress={() => open('new')} />
      </View>
      <Text variant="bodySm" color="textSecondary">{t('routines.intro')}</Text>

      {groups.length === 0 ? (
        <Animated.View entering={FadeIn.duration(motion.base)} style={{ alignItems: 'center', gap: spacing.sm, paddingVertical: spacing.xxxl }}>
          <Mascot pose="calm" size={112} />
          <Text variant="heading" align="center">{t('routines.empty_title')}</Text>
          <Text variant="bodySm" color="textSecondary" align="center">{t('routines.empty_body')}</Text>
          <Button icon="plus" label={t('routines.add')} onPress={() => open('new')} />
        </Animated.View>
      ) : (
        groups.map((g) => (
          <Animated.View key={g.period ?? 'none'} entering={FadeIn.duration(motion.base)} style={{ gap: spacing.sm }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.sm, paddingHorizontal: spacing.xs }}>
              <Icon name={g.period ? periodIcon[g.period] : 'repeat'} size={14} color="textSecondary" />
              <Text variant="overline" color="textSecondary" accessibilityRole="header">{t(`routines.period_${g.period ?? 'any'}`).toUpperCase()}</Text>
            </View>
            <Card padding="md" style={{ gap: 0, paddingVertical: spacing.xs }}>
              {g.items.map((r, i) => (
                <View key={r.id} style={i ? { borderTopWidth: 1, borderTopColor: colors.border } : undefined}>
                  <RoutineRow routine={r} onPress={() => open(r.id)} />
                </View>
              ))}
            </Card>
          </Animated.View>
        ))
      )}
    </Screen>
  );
}

function RoutineRow({ routine, onPress }: { routine: Routine; onPress: () => void }) {
  const { t, i18n } = useTranslation();
  const { spacing, touchTarget } = useTheme();
  const tpl = routine.template ?? {};
  const steps = tpl.steps?.length ?? 0;
  const meta = [
    ruleLabel(routine.rule, t, i18n.language),
    tpl.startTime ? (tpl.endTime ? `${tpl.startTime}–${tpl.endTime}` : tpl.startTime) : null,
    tpl.energy ? t(`task.energy_${tpl.energy}`) : null,
    steps ? t('routines.steps_count', { count: steps }) : null,
  ]
    .filter(Boolean)
    .join(' · ');

  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.sm }}>
      <PressableScale
        accessibilityRole="button"
        accessibilityLabel={t('routines.open', { title: routine.title })}
        onPress={onPress}
        style={{ flex: 1, gap: 3, minHeight: touchTarget + 8, justifyContent: 'center', paddingVertical: spacing.sm, paddingLeft: spacing.xs }}
      >
        <Text variant="subheading" color={routine.active ? 'text' : 'textTertiary'} numberOfLines={2}>{routine.title}</Text>
        <Text variant="caption" color="textSecondary">{meta}</Text>
      </PressableScale>
      <Toggle value={routine.active} onValueChange={(v) => background(setRoutineActive(routine.id, v), 'Toggle routine')} label={t('routines.active')} />
    </View>
  );
}
