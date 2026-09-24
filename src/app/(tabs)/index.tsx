import { router } from 'expo-router';
import type { ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { View } from 'react-native';
import Animated, { FadeInDown } from 'react-native-reanimated';

import { VeyraLockup } from '@/components/brand/logo';
import { Avatar, IconButton, Screen } from '@/components/ui';
import { AssistantCard } from '@/features/home/components/assistant-card';
import { AttentionTasks } from '@/features/home/components/attention-tasks';
import { Bills } from '@/features/home/components/bills';
import { Greeting } from '@/features/home/components/greeting';
import { QuickCapture } from '@/features/home/components/quick-capture';
import { Schedule } from '@/features/home/components/schedule';
import { user } from '@/features/home/mock';
import { useBreakpoint, useTheme } from '@/theme';

/** Staggered, subtle entrance (≈300ms, ease-out). */
function Reveal({ children, index }: { children: ReactNode; index: number }) {
  const { motion } = useTheme();
  return <Animated.View entering={FadeInDown.duration(motion.base).delay(index * 50)}>{children}</Animated.View>;
}

export default function HomeScreen() {
  const { t } = useTranslation();
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
        <IconButton icon="search" label="Search" />
        <IconButton icon="bell" label="Notifications" />
        <Avatar name={user.firstName} size={40} />
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
            <Reveal index={2}><Schedule /></Reveal>
            <Reveal index={3}><Bills /></Reveal>
          </View>
          <View style={{ flex: 1, gap: spacing.xxl }}>
            <Reveal index={2}><AssistantCard /></Reveal>
            <Reveal index={3}><AttentionTasks /></Reveal>
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
        <Reveal index={1}><Schedule /></Reveal>
        <Reveal index={2}><AttentionTasks /></Reveal>
        <Reveal index={3}><Bills /></Reveal>
        <Reveal index={4}><AssistantCard /></Reveal>
      </Screen>
      <View pointerEvents="box-none" style={{ position: 'absolute', left: spacing.lg, right: spacing.lg, bottom: spacing.xxxl + spacing.xs }}>
        <QuickCapture />
      </View>
    </View>
  );
}
