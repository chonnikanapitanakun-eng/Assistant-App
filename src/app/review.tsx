import { router } from 'expo-router';
import { useEffect, useMemo, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { TextInput, View } from 'react-native';

import { Mascot } from '@/components/brand/mascot';
import { Card, Chip, Icon, IconButton, Screen, Text, type IconName } from '@/components/ui';
import { lastSevenDays, todayMinutes } from '@/features/focus/insights';
import { useFocusSessions } from '@/features/focus/queries';
import { formatMoney } from '@/lib/currency';
import { usePrimaryCurrency } from '@/features/profile/store';
import { useTransactions } from '@/features/money/queries';
import { EnergyPicker } from '@/features/review/components/energy-picker';
import { MOOD_EMOJI, MoodPicker } from '@/features/review/components/mood-picker';
import { WeekTrend } from '@/features/review/components/week-trend';
import { average, checkinStreak, daySpend, isScaleValue, lastSevenDaysCheckins, type ScaleValue } from '@/features/review/model';
import { saveCheckin, useCheckinForDate, useCheckins } from '@/features/review/queries';
import { ProgressCard } from '@/features/tasks/components/progress-card';
import { todayProgress } from '@/features/tasks/model';
import { useAllTasks } from '@/features/tasks/queries';
import { background } from '@/lib/background';
import { toDateKey } from '@/lib/date';
import { useTheme } from '@/theme';

type Tab = 'today' | 'week';

export default function ReviewScreen() {
  const { t } = useTranslation();
  const { spacing } = useTheme();
  const [tab, setTab] = useState<Tab>('today');
  const back = () => (router.canGoBack() ? router.back() : router.replace('/'));

  return (
    <Screen maxWidth={720}>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.sm, marginLeft: -spacing.sm }}>
        <IconButton icon="chevron-left" label={t('common.back')} onPress={back} />
        <Text variant="title" accessibilityRole="header" style={{ flex: 1 }}>{t('review.title')}</Text>
      </View>

      <View style={{ flexDirection: 'row', gap: spacing.sm }}>
        <Chip label={t('review.tab_today')} selected={tab === 'today'} onPress={() => setTab('today')} />
        <Chip label={t('review.tab_week')} selected={tab === 'week'} onPress={() => setTab('week')} />
      </View>

      {tab === 'today' ? <TodayTab /> : <WeekTab />}
    </Screen>
  );
}

function TodayTab() {
  const { t } = useTranslation();
  const { colors, spacing, radius } = useTheme();
  const today = toDateKey();
  const { checkin, loaded } = useCheckinForDate(today);
  const tasks = useAllTasks();
  const sessions = useFocusSessions();
  const txs = useTransactions();
  const currency = usePrimaryCurrency();

  const progress = todayProgress(tasks, today);
  const focusMin = todayMinutes(sessions);
  const spent = daySpend(txs, today, currency);
  const mood = checkin?.mood && isScaleValue(checkin.mood) ? checkin.mood : null;
  const energy = checkin?.energy && isScaleValue(checkin.energy) ? checkin.energy : null;

  const [reflection, setReflection] = useState('');
  const seeded = useRef(false);
  const dirty = useRef(false);
  // Seed the field once the day's check-in has loaded (undefined until then means "not logged yet").
  useEffect(() => {
    if (seeded.current || !loaded) return;
    seeded.current = true;
    setReflection(checkin?.reflection ?? '');
  }, [loaded, checkin?.reflection]);
  useEffect(() => {
    if (!dirty.current) return;
    const h = setTimeout(() => {
      background(saveCheckin(today, { reflection: reflection.trim() || null }), 'Save reflection');
      dirty.current = false;
    }, 500);
    return () => clearTimeout(h);
  }, [reflection, today]);

  const setMood = (v: ScaleValue) => background(saveCheckin(today, { mood: v }), 'Save mood');
  const setEnergy = (v: ScaleValue) => background(saveCheckin(today, { energy: v }), 'Save energy');

  return (
    <>
      <Card style={{ gap: spacing.lg }}>
        <View style={{ gap: spacing.xs }}>
          <Text variant="heading">{t('review.checkin_title')}</Text>
          <Text variant="bodySm" color="textSecondary">{t('review.checkin_subtitle')}</Text>
        </View>
        <View style={{ gap: spacing.sm }}>
          <Text variant="label" color="textSecondary">{t('review.mood')}</Text>
          <MoodPicker value={mood} onChange={setMood} />
        </View>
        <View style={{ gap: spacing.sm }}>
          <Text variant="label" color="textSecondary">{t('review.energy')}</Text>
          <EnergyPicker value={energy} onChange={setEnergy} />
        </View>
        <View style={{ gap: spacing.sm }}>
          <Text variant="label" color="textSecondary">{t('review.reflection')}</Text>
          <TextInput
            value={reflection}
            onChangeText={(v) => {
              dirty.current = true;
              setReflection(v);
            }}
            placeholder={t('review.reflection_placeholder')}
            placeholderTextColor={colors.textTertiary}
            accessibilityLabel={t('review.reflection')}
            multiline
            textAlignVertical="top"
            style={{ minHeight: 72, color: colors.text, fontSize: 15, lineHeight: 22, padding: spacing.md, borderRadius: radius.lg, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.surfaceMuted }}
          />
        </View>
      </Card>

      <View style={{ gap: spacing.sm }}>
        <Text variant="overline" color="textSecondary">{t('review.today_summary').toUpperCase()}</Text>
        <ProgressCard done={progress.done} total={progress.total} />
        <View style={{ flexDirection: 'row', gap: spacing.sm }}>
          <StatTile icon="target" value={t('focus.min_short', { count: focusMin })} label={t('review.focus_today')} />
          <StatTile icon="credit-card" value={formatMoney(spent, currency)} label={t('review.spent_today')} />
        </View>
      </View>
    </>
  );
}

function WeekTab() {
  const { t, i18n } = useTranslation();
  const { colors, spacing } = useTheme();
  const checkins = useCheckins();
  const tasks = useAllTasks();
  const sessions = useFocusSessions();
  const locale = i18n.language === 'th' ? 'th-TH' : 'en-GB';

  const days = useMemo(() => lastSevenDaysCheckins(checkins), [checkins]);
  const weekDates = useMemo(() => new Set(days.map((d) => d.date)), [days]);
  const avgMood = average(days.map((d) => d.mood));
  const avgEnergy = average(days.map((d) => d.energy));
  const streak = checkinStreak(checkins);
  const focusWeek = useMemo(() => lastSevenDays(sessions).reduce((sum, d) => sum + d.minutes, 0), [sessions]);
  const tasksWeek = useMemo(() => tasks.filter((x) => x.isDone && x.doneAt && weekDates.has(toDateKey(new Date(x.doneAt)))).length, [tasks, weekDates]);
  const recent = useMemo(() => checkins.filter((c) => c.mood || c.energy || c.reflection).slice(0, 10), [checkins]);
  const formatDate = (d: string) => new Date(`${d}T00:00:00`).toLocaleDateString(locale, { weekday: 'short', day: 'numeric', month: 'short' });

  return (
    <>
      <Card style={{ gap: spacing.md }}>
        <Text variant="heading">{t('review.week_title')}</Text>
        <WeekTrend days={days} />
      </Card>

      <View style={{ flexDirection: 'row', gap: spacing.sm }}>
        <StatTile icon="smile" value={avgMood != null ? String(avgMood) : '—'} label={t('review.avg_mood')} />
        <StatTile icon="zap" value={avgEnergy != null ? String(avgEnergy) : '—'} label={t('review.avg_energy')} />
        <StatTile icon="calendar" value={String(streak)} label={t('review.streak', { count: streak })} />
      </View>
      <View style={{ flexDirection: 'row', gap: spacing.sm }}>
        <StatTile icon="check-circle" value={String(tasksWeek)} label={t('review.tasks_week')} />
        <StatTile icon="target" value={t('focus.hours_short', { value: (focusWeek / 60).toFixed(1) })} label={t('review.focus_week')} />
      </View>

      <View style={{ gap: spacing.sm }}>
        <Text variant="overline" color="textSecondary">{t('review.recent').toUpperCase()}</Text>
        {recent.length === 0 ? (
          <View style={{ alignItems: 'center', gap: spacing.sm, paddingVertical: spacing.xl }}>
            <Mascot pose="calm" size={96} />
            <Text variant="bodySm" color="textSecondary" align="center">{t('review.no_checkins')}</Text>
          </View>
        ) : (
          <Card padding="md" style={{ gap: 0, paddingVertical: spacing.xs }}>
            {recent.map((c, i) => (
              <View
                key={c.id}
                style={[{ flexDirection: 'row', alignItems: 'center', gap: spacing.md, minHeight: 52, paddingHorizontal: spacing.sm }, i ? { borderTopWidth: 1, borderTopColor: colors.border } : undefined]}
              >
                <Text style={{ fontSize: 20 }}>{c.mood && isScaleValue(c.mood) ? MOOD_EMOJI[c.mood] : '·'}</Text>
                <View style={{ flex: 1 }}>
                  <Text variant="label">{formatDate(c.date)}</Text>
                  {c.reflection ? <Text variant="caption" color="textSecondary" numberOfLines={1}>{c.reflection}</Text> : null}
                </View>
              </View>
            ))}
          </Card>
        )}
      </View>
    </>
  );
}

function StatTile({ icon, value, label }: { icon: IconName; value: string; label: string }) {
  const { colors, spacing, radius, shadow } = useTheme();
  return (
    <View style={{ flex: 1, backgroundColor: colors.surface, borderRadius: radius.lg, borderWidth: 1, borderColor: colors.border, padding: spacing.md, gap: spacing.xs, boxShadow: shadow.sm }}>
      <Icon name={icon} size={16} color="primary" />
      <Text variant="subheading" numberOfLines={1} adjustsFontSizeToFit>{value}</Text>
      <Text variant="caption" color="textSecondary">{label}</Text>
    </View>
  );
}
