import { router, useLocalSearchParams } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { AppState, ScrollView, View } from 'react-native';
import Animated, { FadeIn } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Mascot } from '@/components/brand/mascot';
import { Gradient, Icon, PressableScale, Text, type IconName } from '@/components/ui';
import type { Task } from '@/db';
import { Ambient } from '@/features/focus/components/ambient';
import { FocusRing } from '@/features/focus/components/focus-ring';
import { WeekChart } from '@/features/focus/components/week-chart';
import { lastSevenDays, streak, todayMinutes } from '@/features/focus/insights';
import { useFocusSessions } from '@/features/focus/queries';
import { BREAK_MINUTES, FOCUS_PRESETS, useFocus } from '@/features/focus/store';
import { clock, MIN, progress, remaining } from '@/features/focus/timer';
import { toggleTaskDone, useAllTasks } from '@/features/tasks/queries';
import { toDateKey } from '@/lib/date';
import { useBreakpoint, useTheme } from '@/theme';

/** Focus is always dark and immersive, whatever the app theme. */
const ink = { bg: '#0B1020', fg: '#F8FAFC', fg2: '#A3B1C6', line: 'rgba(255,255,255,0.12)', glass: 'rgba(255,255,255,0.07)', mark: '#7C83F5' };

export default function FocusScreen() {
  const { t } = useTranslation();
  const { spacing } = useTheme();
  const insets = useSafeAreaInsets();
  const { taskId: taskParam } = useLocalSearchParams<{ taskId?: string }>();
  const [tab, setTab] = useState<'timer' | 'insights'>('timer');
  const setTask = useFocus((s) => s.setTask);
  const idle = useFocus((s) => s.timer.status === 'idle');

  // Opening Focus from a task pre-selects it (only when nothing is running).
  useEffect(() => {
    if (taskParam && idle) setTask(taskParam);
  }, [taskParam, idle, setTask]);

  const close = () => (router.canGoBack() ? router.back() : router.replace('/'));

  return (
    <View style={{ flex: 1, backgroundColor: ink.bg }}>
      <StatusBar style="light" />
      <Ambient active={!idle} />
      <View style={{ flex: 1, paddingTop: insets.top + spacing.sm, paddingBottom: insets.bottom }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', paddingHorizontal: spacing.lg, gap: spacing.sm }}>
          <RoundButton icon="x" label={t('common.close')} onPress={close} />
          <View style={{ flex: 1, alignItems: 'center' }}>
            <View accessibilityRole="tablist" style={{ flexDirection: 'row', backgroundColor: ink.glass, borderRadius: 999, padding: 4 }}>
              {(['timer', 'insights'] as const).map((k) => (
                <PressableScale
                  key={k}
                  accessibilityRole="tab"
                  accessibilityState={{ selected: tab === k }}
                  accessibilityLabel={t(`focus.tab_${k}`)}
                  onPress={() => setTab(k)}
                  style={{ minHeight: 40, paddingHorizontal: spacing.lg, justifyContent: 'center', borderRadius: 999, backgroundColor: tab === k ? 'rgba(255,255,255,0.14)' : 'transparent' }}
                >
                  <Text variant="label" weight="semibold" tone={tab === k ? ink.fg : ink.fg2}>{t(`focus.tab_${k}`)}</Text>
                </PressableScale>
              ))}
            </View>
          </View>
          <View style={{ width: 44 }} />
        </View>
        {tab === 'timer' ? <TimerView /> : <InsightsView />}
      </View>
    </View>
  );
}

function TimerView() {
  const { t } = useTranslation();
  const { spacing } = useTheme();
  const { width, isDesktop } = useBreakpoint();
  const store = useFocus();
  const tasks = useAllTasks();
  const [picking, setPicking] = useState(false);
  // "Now" is state (not read during render) so the component stays pure.
  const [now, setNow] = useState(() => Date.now());
  const { timer, finished } = store;
  const running = timer.status === 'running';
  const active = timer.status === 'running' || timer.status === 'paused';

  // Re-render every second while running; settle the timer when it runs out or the app returns.
  useEffect(() => {
    if (!running) return;
    const id = setInterval(() => {
      useFocus.getState().tick();
      setNow(Date.now());
    }, 1000);
    return () => clearInterval(id);
  }, [running]);
  useEffect(() => {
    const sub = AppState.addEventListener('change', (s) => s === 'active' && useFocus.getState().tick());
    return () => sub.remove();
  }, []);

  const task = tasks.find((x) => x.id === (active ? timer.taskId : store.taskId));
  const doneTask = tasks.find((x) => x.id === finished?.taskId);
  const size = Math.min(isDesktop ? 380 : width - 72, 380);
  const left = active ? remaining(timer, now) : store.minutes * MIN;
  const phase = active ? timer.phase : 'focus';

  if (finished) return <FinishedView task={doneTask} />;

  return (
    <ScrollView contentContainerStyle={{ flexGrow: 1, alignItems: 'center', justifyContent: 'center', padding: spacing.xl, gap: spacing.xxl }}>
      <PressableScale
        accessibilityRole="button"
        accessibilityLabel={task ? t('focus.focus_on', { title: task.title }) : t('focus.choose_task')}
        disabled={active}
        onPress={() => setPicking(!picking)}
        style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.sm, minHeight: 44, paddingHorizontal: spacing.lg, borderRadius: 999, backgroundColor: ink.glass, maxWidth: 420 }}
      >
        <Icon name={task ? 'target' : 'plus'} size={16} tone={ink.fg2} />
        <Text variant="label" tone={ink.fg} numberOfLines={1} style={{ flexShrink: 1 }}>
          {phase === 'break' ? t('focus.break_label') : task ? t('focus.focus_on', { title: task.title }) : t('focus.choose_task')}
        </Text>
        {!active ? <Icon name={picking ? 'chevron-up' : 'chevron-down'} size={16} tone={ink.fg2} /> : null}
      </PressableScale>

      {picking && !active ? <TaskPicker tasks={tasks} selected={store.taskId} onPick={(id) => (store.setTask(id), setPicking(false))} /> : null}

      <FocusRing size={size} progress={active ? progress(timer, now) : 0}>
        <View accessible accessibilityRole="timer" accessibilityLabel={t('focus.remaining', { time: clock(left) })} style={{ alignItems: 'center', gap: 4 }}>
          <Text tone={ink.fg} style={{ fontSize: Math.round(size * 0.2), lineHeight: Math.round(size * 0.24), fontFamily: 'Inter_600SemiBold', fontVariant: ['tabular-nums'], letterSpacing: -1 }}>{clock(left)}</Text>
          <Text variant="label" tone={ink.fg2}>{timer.status === 'paused' ? t('focus.paused') : phase === 'break' ? t('focus.break') : t('focus.focus')}</Text>
        </View>
      </FocusRing>

      {!active ? (
        <View style={{ flexDirection: 'row', gap: spacing.sm }}>
          {FOCUS_PRESETS.map((m) => {
            const on = store.minutes === m;
            return (
              <PressableScale
                key={m}
                accessibilityRole="radio"
                accessibilityState={{ checked: on }}
                accessibilityLabel={t('focus.minutes', { count: m })}
                onPress={() => store.setMinutes(m)}
                style={{ minHeight: 44, minWidth: 72, alignItems: 'center', justifyContent: 'center', borderRadius: 999, borderWidth: 1.5, borderColor: on ? ink.fg : ink.line, backgroundColor: on ? 'rgba(255,255,255,0.12)' : 'transparent' }}
              >
                <Text variant="label" weight="semibold" tone={on ? ink.fg : ink.fg2}>{t('focus.min_short', { count: m })}</Text>
              </PressableScale>
            );
          })}
        </View>
      ) : null}

      <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.xl }}>
        {active ? <RoundButton icon="square" label={t('focus.stop')} onPress={store.stop} /> : null}
        <PressableScale
          accessibilityRole="button"
          accessibilityLabel={running ? t('focus.pause') : active ? t('focus.resume') : t('focus.start')}
          onPress={running ? store.pause : active ? store.resume : () => store.start('focus')}
          style={{ borderRadius: 40, boxShadow: '0px 10px 30px rgba(99,102,241,0.45)' }}
        >
          <Gradient variant="ai" style={{ width: 80, height: 80, borderRadius: 40, alignItems: 'center', justifyContent: 'center' }}>
            <Icon name={running ? 'pause' : 'play'} size={32} tone="#FFFFFF" />
          </Gradient>
        </PressableScale>
        {active ? <RoundButton icon="plus" label={t('focus.add_five')} caption="+5" onPress={() => store.extend(5)} /> : null}
      </View>
    </ScrollView>
  );
}

function TaskPicker({ tasks, selected, onPick }: { tasks: Task[]; selected: string | null; onPick: (id: string | null) => void }) {
  const { t } = useTranslation();
  const { spacing } = useTheme();
  const today = toDateKey();
  const options = tasks.filter((x) => !x.isDone && (!x.date || x.date <= today)).sort((a, b) => a.priority - b.priority).slice(0, 8);
  const row = (id: string | null, label: string) => (
    <PressableScale
      key={id ?? 'none'}
      accessibilityRole="radio"
      accessibilityState={{ checked: selected === id }}
      accessibilityLabel={label}
      onPress={() => onPick(id)}
      style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.md, minHeight: 48, paddingHorizontal: spacing.lg }}
    >
      <Icon name={selected === id ? 'check-circle' : 'circle'} size={18} tone={selected === id ? ink.fg : ink.fg2} />
      <Text variant="bodySm" tone={ink.fg} numberOfLines={1} style={{ flex: 1 }}>{label}</Text>
    </PressableScale>
  );
  return (
    <Animated.View entering={FadeIn.duration(200)} style={{ width: '100%', maxWidth: 420, backgroundColor: 'rgba(17,24,39,0.92)', borderRadius: 20, borderWidth: 1, borderColor: ink.line, paddingVertical: spacing.xs }}>
      {row(null, t('focus.no_task'))}
      {options.map((x) => row(x.id, x.title))}
    </Animated.View>
  );
}

function FinishedView({ task }: { task?: Task }) {
  const { t } = useTranslation();
  const { spacing } = useTheme();
  const { finished, start, dismiss } = useFocus();
  if (!finished) return null;
  const wasFocus = finished.phase === 'focus';
  return (
    <Animated.View entering={FadeIn.duration(400)} accessibilityLiveRegion="polite" style={{ flex: 1, alignItems: 'center', justifyContent: 'center', padding: spacing.xl, gap: spacing.lg }}>
      <Mascot pose={wasFocus ? 'celebrate' : 'calm'} size={140} />
      <Text variant="title" tone={ink.fg} align="center">{wasFocus ? t('focus.done_title', { count: finished.minutes }) : t('focus.break_done_title')}</Text>
      <Text variant="body" tone={ink.fg2} align="center">{wasFocus ? t('focus.done_body') : t('focus.break_done_body')}</Text>
      {wasFocus && task && !task.isDone ? <PillButton icon="check" label={t('focus.mark_task_done', { title: task.title })} onPress={() => toggleTaskDone(task)} /> : null}
      {wasFocus && task?.isDone ? <Text variant="label" tone={ink.fg2}>✓ {t('focus.task_marked_done')}</Text> : null}
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'center', gap: spacing.sm }}>
        {wasFocus ? <PillButton icon="coffee" label={t('focus.take_break', { count: BREAK_MINUTES })} primary onPress={() => start('break')} /> : null}
        <PillButton icon="play" label={t('focus.another_round')} primary={!wasFocus} onPress={() => start('focus')} />
        <PillButton icon="x" label={t('common.done')} onPress={dismiss} />
      </View>
    </Animated.View>
  );
}

function InsightsView() {
  const { t, i18n } = useTranslation();
  const { spacing } = useTheme();
  const sessions = useFocusSessions();
  const tasks = useAllTasks();
  const week = useMemo(() => lastSevenDays(sessions), [sessions]);
  const today = todayMinutes(sessions);
  const days = streak(sessions);
  const weekTotal = week.reduce((s, d) => s + d.minutes, 0);
  const locale = i18n.language === 'th' ? 'th-TH' : 'en-GB';

  const tile = (value: string, label: string) => (
    <View style={{ flex: 1, backgroundColor: ink.glass, borderRadius: 20, padding: spacing.lg, gap: 2 }}>
      <Text variant="title" tone={ink.fg} numberOfLines={1} adjustsFontSizeToFit style={{ fontVariant: ['tabular-nums'] }}>{value}</Text>
      <Text variant="caption" tone={ink.fg2}>{label}</Text>
    </View>
  );

  return (
    <ScrollView contentContainerStyle={{ width: '100%', maxWidth: 640, alignSelf: 'center', padding: spacing.xl, gap: spacing.xl }}>
      <View style={{ flexDirection: 'row', gap: spacing.sm }}>
        {tile(t('focus.min_short', { count: today }), t('focus.today'))}
        {tile(String(days), t('focus.streak', { count: days }))}
        {tile(t('focus.hours_short', { value: (weekTotal / 60).toFixed(1) }), t('focus.this_week'))}
      </View>
      <View style={{ backgroundColor: ink.glass, borderRadius: 20, padding: spacing.lg, gap: spacing.md }}>
        <Text variant="subheading" tone={ink.fg}>{t('focus.last_7_days')}</Text>
        <WeekChart days={week} fg={ink.fg} fg2={ink.fg2} mark={ink.mark} track={ink.line} />
      </View>
      <View style={{ gap: spacing.sm }}>
        <Text variant="overline" tone={ink.fg2}>{t('focus.recent').toUpperCase()}</Text>
        {sessions.length === 0 ? (
          <View style={{ alignItems: 'center', gap: spacing.sm, paddingVertical: spacing.xl }}>
            <Mascot pose="focus" size={96} />
            <Text variant="bodySm" tone={ink.fg2} align="center">{t('focus.no_sessions')}</Text>
          </View>
        ) : (
          sessions.slice(0, 8).map((s) => {
            const task = tasks.find((x) => x.id === s.taskId);
            const when = new Date(s.startedAt).toLocaleString(locale, { weekday: 'short', hour: '2-digit', minute: '2-digit' });
            return (
              <View key={s.id} style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.md, minHeight: 52, paddingHorizontal: spacing.md, borderRadius: 16, backgroundColor: ink.glass }}>
                <Icon name={s.completed ? 'check-circle' : 'minus-circle'} size={18} tone={s.completed ? '#6EE7B7' : ink.fg2} />
                <View style={{ flex: 1 }}>
                  <Text variant="label" tone={ink.fg} numberOfLines={1}>{task?.title ?? t('focus.no_task')}</Text>
                  <Text variant="caption" tone={ink.fg2}>{when} · {s.completed ? t('focus.completed') : t('focus.stopped_early')}</Text>
                </View>
                <Text variant="label" weight="semibold" tone={ink.fg} style={{ fontVariant: ['tabular-nums'] }}>{t('focus.min_short', { count: s.durationMin })}</Text>
              </View>
            );
          })
        )}
      </View>
    </ScrollView>
  );
}

function RoundButton({ icon, label, onPress, caption }: { icon: IconName; label: string; onPress: () => void; caption?: string }) {
  return (
    <PressableScale accessibilityRole="button" accessibilityLabel={label} onPress={onPress} style={{ width: 56, height: 56, borderRadius: 28, alignItems: 'center', justifyContent: 'center', backgroundColor: ink.glass, borderWidth: 1, borderColor: ink.line }}>
      {caption ? <Text variant="label" weight="bold" tone={ink.fg}>{caption}</Text> : <Icon name={icon} size={20} tone={ink.fg} />}
    </PressableScale>
  );
}

function PillButton({ icon, label, onPress, primary }: { icon: IconName; label: string; onPress: () => void; primary?: boolean }) {
  const { spacing } = useTheme();
  const content = (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.sm, minHeight: 48, paddingHorizontal: spacing.xl }}>
      <Icon name={icon} size={18} tone="#FFFFFF" />
      <Text variant="label" weight="semibold" tone="#FFFFFF" numberOfLines={1}>{label}</Text>
    </View>
  );
  return (
    <PressableScale accessibilityRole="button" accessibilityLabel={label} onPress={onPress} style={{ borderRadius: 999, overflow: 'hidden', backgroundColor: primary ? 'transparent' : ink.glass, borderWidth: primary ? 0 : 1, borderColor: ink.line, maxWidth: '100%' }}>
      {primary ? <Gradient variant="ai">{content}</Gradient> : content}
    </PressableScale>
  );
}
