import { LinearGradient } from 'expo-linear-gradient';
import { router, useLocalSearchParams } from 'expo-router';
import { useState, type ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { Platform, ScrollView, TextInput, View } from 'react-native';
import Animated, { FadeIn, FadeInDown } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Mascot, type MascotPose } from '@/components/brand/mascot';
import { Button, Chip, Icon, IconButton, PressableScale, Text, type IconName } from '@/components/ui';
import { requestPermission } from '@/features/notifications';
import { completeOnboarding } from '@/features/onboarding/complete';
import { setLanguage } from '@/features/profile/language';
import { ALL_INTERESTS, useProfile, type Interest } from '@/features/profile/store';
import { background } from '@/lib/background';
import { currencySymbol, supportedCurrencies } from '@/lib/currency';
import { useTheme } from '@/theme';

const steps: MascotPose[] = ['wave', 'happy', 'thinking', 'idea', 'celebrate'];
const interestIcons: Record<Interest, IconName> = { tasks: 'check-square', calendar: 'calendar', money: 'credit-card', notes: 'file-text', focus: 'target' };

/**
 * First-run setup: welcome → name → language & currency → interests → ready. Every step can be skipped.
 * `?replay=1` (from Settings) walks the same steps without the sample-data choice and returns back.
 */
export default function Onboarding() {
  const { t } = useTranslation();
  const { colors, spacing } = useTheme();
  const insets = useSafeAreaInsets();
  const { replay } = useLocalSearchParams<{ replay?: string }>();
  const replaying = replay === '1';
  const profile = useProfile();
  const [step, setStep] = useState(0);
  const [name, setName] = useState(profile.name);
  const [sample, setSample] = useState(true);
  const [notify, setNotify] = useState<'idle' | 'granted' | 'denied'>('idle');
  const [nameFocused, setNameFocused] = useState(false);
  const [finishing, setFinishing] = useState(false);

  const last = step === steps.length - 1;
  const next = () => {
    if (step === 1) profile.update({ name: name.trim() });
    if (last) {
      if (replaying) return leave();
      finish(sample);
      return;
    }
    setStep(step + 1);
  };
  const leave = () => (router.canGoBack() ? router.back() : router.replace('/'));
  const skipAll = () => {
    if (replaying) return leave();
    finish(false);
  };
  // Adding sample data is async; enter the app once it's in (completeOnboarding never throws).
  const finish = (withSample: boolean) => {
    if (finishing) return;
    setFinishing(true);
    background(completeOnboarding({ sample: withSample }).finally(() => router.replace('/')), 'Finish onboarding');
  };

  const toggleInterest = (i: Interest) => {
    const has = profile.interests.includes(i);
    if (has && profile.interests.length === 1) return; // keep at least one
    profile.update({ interests: has ? profile.interests.filter((x) => x !== i) : [...profile.interests, i] });
  };

  const body: ReactNode[] = [
    <Intro key="0" title={t('onboarding.welcome_title')} body={t('onboarding.welcome_body')} />,
    <Intro key="1" title={t('onboarding.name_title')} body={t('onboarding.name_body')}>
      <TextInput
        autoFocus
        value={name}
        onChangeText={setName}
        onSubmitEditing={next}
        onFocus={() => setNameFocused(true)}
        onBlur={() => setNameFocused(false)}
        returnKeyType="next"
        placeholder={t('onboarding.name_placeholder')}
        placeholderTextColor={colors.textTertiary}
        accessibilityLabel={t('onboarding.name_title')}
        style={{ alignSelf: 'stretch', minHeight: 56, borderRadius: 16, borderWidth: 1.5, borderColor: nameFocused ? colors.focusRing : colors.border, backgroundColor: colors.surface, paddingHorizontal: spacing.lg, fontSize: 20, fontFamily: 'Inter_600SemiBold', color: colors.text, textAlign: 'center' }}
      />
    </Intro>,
    <Intro key="2" title={t('onboarding.prefs_title')} body={t('onboarding.prefs_body')}>
      <Group label={t('onboarding.language')}>
        <Chip label="English" selected={profile.language === 'en'} onPress={() => setLanguage('en')} />
        <Chip label="ไทย" selected={profile.language === 'th'} onPress={() => setLanguage('th')} />
      </Group>
      <Group label={t('onboarding.currency')} hint={t('onboarding.currency_hint')}>
        {supportedCurrencies.map((c) => (
          <Chip key={c} label={`${currencySymbol(c)} ${c}`} selected={profile.currency === c} onPress={() => profile.update({ currency: c })} />
        ))}
      </Group>
    </Intro>,
    <Intro key="3" title={t('onboarding.interests_title')} body={t('onboarding.interests_body')}>
      <View style={{ alignSelf: 'stretch', gap: spacing.sm }}>
        {ALL_INTERESTS.map((i) => (
          <OptionCard key={i} icon={interestIcons[i]} title={t(`onboarding.interest_${i}`)} body={t(`onboarding.interest_${i}_body`)} selected={profile.interests.includes(i)} multi onPress={() => toggleInterest(i)} />
        ))}
      </View>
    </Intro>,
    <Intro key="4" title={name.trim() ? t('onboarding.ready_title_named', { name: name.trim() }) : t('onboarding.ready_title')} body={replaying ? t('onboarding.ready_body_replay') : t('onboarding.ready_body')}>
      {Platform.OS !== 'web' ? (
        <OptionCard
          icon="bell"
          title={t('onboarding.notify_title')}
          body={notify === 'granted' ? t('onboarding.notify_on') : notify === 'denied' ? t('onboarding.notify_denied') : t('onboarding.notify_body')}
          selected={notify === 'granted'}
          onPress={async () => setNotify((await requestPermission()) === 'granted' ? 'granted' : 'denied')}
        />
      ) : null}
      {!replaying ? (
        <View accessibilityRole="radiogroup" style={{ alignSelf: 'stretch', gap: spacing.sm }}>
          <OptionCard icon="compass" title={t('onboarding.sample_title')} body={t('onboarding.sample_body')} selected={sample} onPress={() => setSample(true)} />
          <OptionCard icon="feather" title={t('onboarding.fresh_title')} body={t('onboarding.fresh_body')} selected={!sample} onPress={() => setSample(false)} />
        </View>
      ) : null}
    </Intro>,
  ];

  return (
    <View style={{ flex: 1, backgroundColor: colors.background }}>
      <LinearGradient
        pointerEvents="none"
        colors={['rgba(99,102,241,0.20)', 'rgba(244,114,182,0.10)', 'rgba(253,186,116,0)']}
        locations={[0, 0.45, 1]}
        style={{ position: 'absolute', top: 0, left: 0, right: 0, height: 420 }}
      />
      <View style={{ flex: 1, paddingTop: insets.top + spacing.sm, paddingBottom: insets.bottom + spacing.lg }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', paddingHorizontal: spacing.lg, minHeight: 48 }}>
          <View style={{ width: 88 }}>{step > 0 ? <IconButton icon="chevron-left" label={t('common.back')} onPress={() => setStep(step - 1)} /> : null}</View>
          <View accessibilityRole="progressbar" accessibilityValue={{ min: 1, max: steps.length, now: step + 1 }} accessibilityLabel={t('onboarding.progress', { step: step + 1, total: steps.length })} style={{ flex: 1, flexDirection: 'row', justifyContent: 'center', gap: 6 }}>
            {steps.map((_, i) => (
              <View key={i} style={{ width: i === step ? 22 : 8, height: 8, borderRadius: 4, backgroundColor: i <= step ? colors.primary : colors.borderStrong }} />
            ))}
          </View>
          <View style={{ width: 88, alignItems: 'flex-end' }}>
            {!last ? (
              <PressableScale accessibilityRole="button" accessibilityLabel={step === 0 ? (replaying ? t('common.close') : t('onboarding.skip_setup')) : t('onboarding.skip')} onPress={step === 0 ? skipAll : next} style={{ minHeight: 44, justifyContent: 'center', paddingHorizontal: spacing.sm }}>
                <Text variant="label" color="textSecondary">{step === 0 ? (replaying ? t('common.close') : t('onboarding.skip_setup')) : t('onboarding.skip')}</Text>
              </PressableScale>
            ) : null}
          </View>
        </View>

        <ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={{ flexGrow: 1, justifyContent: 'center', alignItems: 'center', paddingHorizontal: spacing.xl, paddingVertical: spacing.lg }}>
          <View style={{ width: '100%', maxWidth: 480, alignItems: 'center', gap: spacing.xl }}>
            <Animated.View key={`m${step}`} entering={FadeIn.duration(450)}>
              <Mascot pose={steps[step]} size={step === 0 ? 200 : 128} />
            </Animated.View>
            <Animated.View key={`b${step}`} entering={FadeInDown.duration(320)} style={{ alignSelf: 'stretch', alignItems: 'center', gap: spacing.xl }}>
              {body[step]}
            </Animated.View>
          </View>
        </ScrollView>

        <View style={{ paddingHorizontal: spacing.xl, alignItems: 'center' }}>
          <View style={{ width: '100%', maxWidth: 480 }}>
            <Button fullWidth icon={last ? 'arrow-right' : undefined} label={step === 0 ? t('onboarding.get_started') : last ? (replaying ? t('common.done') : t('onboarding.start')) : t('onboarding.continue')} disabled={finishing} onPress={next} />
          </View>
        </View>
      </View>
    </View>
  );
}

function Intro({ title, body, children }: { title: string; body: string; children?: ReactNode }) {
  const { spacing } = useTheme();
  return (
    <>
      <View style={{ gap: spacing.sm, alignItems: 'center' }}>
        <Text variant="display" align="center" accessibilityRole="header">{title}</Text>
        <Text variant="body" color="textSecondary" align="center">{body}</Text>
      </View>
      {children}
    </>
  );
}

function Group({ label, hint, children }: { label: string; hint?: string; children: ReactNode }) {
  const { spacing } = useTheme();
  return (
    <View style={{ alignSelf: 'stretch', gap: spacing.sm, alignItems: 'center' }}>
      <Text variant="overline" color="textSecondary">{label.toUpperCase()}</Text>
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'center', gap: spacing.sm }}>{children}</View>
      {hint ? <Text variant="caption" color="textTertiary" align="center">{hint}</Text> : null}
    </View>
  );
}

function OptionCard({ icon, title, body, selected, onPress, multi }: { icon: IconName; title: string; body: string; selected: boolean; onPress: () => void; multi?: boolean }) {
  const { colors, spacing, radius } = useTheme();
  return (
    <PressableScale
      accessibilityRole={multi ? 'checkbox' : 'radio'}
      accessibilityState={multi ? { checked: selected } : { selected }}
      accessibilityLabel={`${title}. ${body}`}
      onPress={onPress}
      style={{ alignSelf: 'stretch', flexDirection: 'row', alignItems: 'center', gap: spacing.md, padding: spacing.lg, borderRadius: radius.card, borderWidth: 1.5, borderColor: selected ? colors.primary : colors.border, backgroundColor: selected ? colors.primarySoft : colors.surface }}
    >
      <View style={{ width: 40, height: 40, borderRadius: 12, backgroundColor: selected ? colors.surface : colors.surfaceMuted, alignItems: 'center', justifyContent: 'center' }}>
        <Icon name={icon} size={18} color={selected ? 'primary' : 'textSecondary'} />
      </View>
      <View style={{ flex: 1, gap: 2 }}>
        <Text variant="subheading">{title}</Text>
        <Text variant="caption" color="textSecondary">{body}</Text>
      </View>
      <View style={{ width: 24, height: 24, borderRadius: multi ? 8 : 12, borderWidth: 2, borderColor: selected ? colors.primary : colors.borderStrong, backgroundColor: selected ? colors.primary : 'transparent', alignItems: 'center', justifyContent: 'center' }}>
        {selected ? <Icon name="check" size={14} tone={colors.onPrimary} /> : null}
      </View>
    </PressableScale>
  );
}
