import { router } from 'expo-router';
import type { ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { View } from 'react-native';
import Animated, { FadeInDown } from 'react-native-reanimated';

import { VeyraLockup } from '@/components/brand/logo';
import { Avatar, IconButton, PressableScale, Screen } from '@/components/ui';
import { AssistantCard } from '@/features/home/components/assistant-card';
import { AttentionTasks } from '@/features/home/components/attention-tasks';
import { Bills } from '@/features/home/components/bills';
import { Greeting } from '@/features/home/components/greeting';
import { QuickCapture } from '@/features/home/components/quick-capture';
import { Schedule } from '@/features/home/components/schedule';
import { useProfile } from '@/features/profile/store';
import { useBreakpoint, useTheme } from '@/theme';

/** Staggered, subtle entrance (≈300ms, ease-out). */
function Reveal({ children, index }: { children: ReactNode; index: number }) {
  const { motion } = useTheme();
  return <Animated.View entering={FadeInDown.duration(motion.base).delay(index * 50)}>{children}</Animated.View>;
}

export default function HomeScreen() {
  const { t } = useTranslation();
  const name = useProfile((p) => p.name);
  const interests = useProfile((p) => p.interests);
  // Home only shows the areas picked during onboarding.
  const show = { tasks: interests.includes('tasks'), calendar: interests.includes('calendar'), money: interests.includes('money') };
  const { bp, isDesktop } = useBreakpoint();
  const { spacing } = useTheme();
  const columns = bp !== 'mobile';

  const header = (
    <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
      {isDesktop ? (
        <View />
      ) : (
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.xs, marginLeft: -spacing.sm }}>
          <IconButton icon="menu" label={t('more.title')} onPress={() => router.push('/more')} />
          <VeyraLockup size={30} />
        </View>
      )}
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.xs }}>
        <IconButton icon="search" label={t('search.title')} onPress={() => router.push('/search')} />
        <IconButton icon="bell" label="Notifications" />
        <PressableScale accessibilityRole="button" accessibilityLabel={t('settings.title')} onPress={() => router.push('/settings')} style={{ borderRadius: 22 }}>
          <Avatar name={name || 'V'} size={40} />
        </PressableScale>
      </View>
    </View>
  );

  if (columns) {
    return (
      <Screen>
        {header}
        <Reveal index={0}><Greeting /></Reveal>
        <Reveal index={1}><QuickCapture /></Reveal>
        <View style={{ flexDirection: 'row', gap: spacing.xxl, alignItems: 'flex-start' }}>
          <View style={{ flex: 1.35, gap: spacing.xxl }}>
            {show.calendar ? <Reveal index={2}><Schedule /></Reveal> : null}
            {show.money ? <Reveal index={3}><Bills /></Reveal> : null}
          </View>
          <View style={{ flex: 1, gap: spacing.xxl }}>
            <Reveal index={2}><AssistantCard /></Reveal>
            {show.tasks ? <Reveal index={3}><AttentionTasks /></Reveal> : null}
          </View>
        </View>
      </Screen>
    );
  }

  return (
    <View style={{ flex: 1 }}>
      <Screen bottomInset={96}>
        {header}
        <Reveal index={0}><Greeting /></Reveal>
        {show.calendar ? <Reveal index={1}><Schedule /></Reveal> : null}
        {show.tasks ? <Reveal index={2}><AttentionTasks /></Reveal> : null}
        {show.money ? <Reveal index={3}><Bills /></Reveal> : null}
        <Reveal index={4}><AssistantCard /></Reveal>
      </Screen>
      <View pointerEvents="box-none" style={{ position: 'absolute', left: spacing.lg, right: spacing.lg, bottom: spacing.xxxl + spacing.xs }}>
        <QuickCapture />
      </View>
    </View>
  );
}
