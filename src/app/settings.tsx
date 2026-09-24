import Constants from 'expo-constants';
import { router } from 'expo-router';
import { useState, type ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { Linking, Platform, TextInput, View } from 'react-native';

import { Mascot } from '@/components/brand/mascot';
import { Button, Card, Chip, Icon, IconButton, PressableScale, Screen, Text, Toggle, type IconName } from '@/components/ui';
import { useNotificationPermission } from '@/features/notifications';
import { setLanguage } from '@/features/profile/language';
import { ALL_INTERESTS, useProfile, type Interest } from '@/features/profile/store';
import { currencySymbol, supportedCurrencies } from '@/lib/currency';
import { useTheme } from '@/theme';

const interestIcons: Record<Interest, IconName> = { tasks: 'check-square', calendar: 'calendar', money: 'credit-card', notes: 'file-text', focus: 'target' };

export default function SettingsScreen() {
  const { t } = useTranslation();
  const { colors, spacing, radius, typography, fontFamily } = useTheme();
  const profile = useProfile();
  const [name, setName] = useState(profile.name);
  const [nameFocused, setNameFocused] = useState(false);
  const back = () => (router.canGoBack() ? router.back() : router.replace('/'));

  const saveName = () => {
    const trimmed = name.trim();
    if (trimmed !== profile.name) profile.update({ name: trimmed });
  };
  const toggleInterest = (i: Interest) => {
    const on = profile.interests.includes(i);
    if (on && profile.interests.length === 1) return; // keep at least one
    profile.update({ interests: on ? profile.interests.filter((x) => x !== i) : [...profile.interests, i] });
  };

  return (
    <Screen maxWidth={720}>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.sm, marginLeft: -spacing.sm }}>
        <IconButton icon="chevron-left" label={t('common.back')} onPress={back} />
        <Text variant="title" accessibilityRole="header">{t('settings.title')}</Text>
      </View>

      <Section title={t('settings.profile')}>
        <Row icon="user" label={t('settings.name')}>
          <TextInput
            value={name}
            onChangeText={setName}
            onFocus={() => setNameFocused(true)}
            onBlur={() => (setNameFocused(false), saveName())}
            onSubmitEditing={saveName}
            returnKeyType="done"
            placeholder={t('onboarding.name_placeholder')}
            placeholderTextColor={colors.textTertiary}
            accessibilityLabel={t('settings.name')}
            style={{ minWidth: 0, flex: 1, maxWidth: 240, minHeight: 44, textAlign: 'right', paddingHorizontal: spacing.md, borderRadius: radius.md, borderWidth: 1.5, borderColor: nameFocused ? colors.focusRing : 'transparent', backgroundColor: nameFocused ? colors.surfaceMuted : 'transparent', color: colors.text, fontSize: typography.body.fontSize, fontFamily: fontFamily.medium }}
          />
        </Row>
      </Section>

      <Section title={t('settings.preferences')}>
        <Stacked icon="globe" label={t('onboarding.language')}>
          <Chip label="English" selected={profile.language === 'en'} onPress={() => setLanguage('en')} />
          <Chip label="ไทย" selected={profile.language === 'th'} onPress={() => setLanguage('th')} />
        </Stacked>
        <Divider />
        <Stacked icon="dollar-sign" label={t('onboarding.currency')} hint={t('settings.currency_hint')}>
          {supportedCurrencies.map((c) => (
            <Chip key={c} label={`${currencySymbol(c)} ${c}`} selected={profile.currency === c} onPress={() => profile.update({ currency: c })} />
          ))}
        </Stacked>
      </Section>

      <Section title={t('settings.home')} hint={t('settings.home_hint')}>
        {ALL_INTERESTS.map((i, idx) => {
          const on = profile.interests.includes(i);
          const locked = on && profile.interests.length === 1;
          return (
            <View key={i}>
              {idx ? <Divider /> : null}
              <Row icon={interestIcons[i]} label={t(`onboarding.interest_${i}`)} sub={t(`onboarding.interest_${i}_body`)}>
                <Toggle value={on} disabled={locked} onValueChange={() => toggleInterest(i)} label={t(`onboarding.interest_${i}`)} />
              </Row>
            </View>
          );
        })}
      </Section>

      {Platform.OS !== 'web' ? <NotificationsSection /> : null}

      <Section title={t('settings.help')}>
        <PressableScale accessibilityRole="button" accessibilityLabel={t('settings.replay')} onPress={() => router.push({ pathname: '/onboarding', params: { replay: '1' } })}>
          <Row icon="play-circle" label={t('settings.replay')} sub={t('settings.replay_body')}>
            <Icon name="chevron-right" size={18} color="textTertiary" />
          </Row>
        </PressableScale>
      </Section>

      <View style={{ alignItems: 'center', gap: spacing.sm, paddingVertical: spacing.xl }}>
        <Mascot pose="calm" size={72} />
        <Text variant="label" color="textSecondary">Veyra · {t('settings.version', { version: Constants.expoConfig?.version ?? '—' })}</Text>
        <Text variant="caption" color="textTertiary">Your life, handled.</Text>
      </View>
    </Screen>
  );
}

function NotificationsSection() {
  const { t } = useTranslation();
  const { state, request } = useNotificationPermission();
  const label = state === 'granted' ? t('settings.notify_on') : state === 'denied' ? t('settings.notify_denied') : t('settings.notify_off');
  return (
    <Section title={t('onboarding.notify_title')}>
      <Row icon="bell" label={t('settings.notifications')} sub={label}>
        {state === 'granted' ? (
          <Icon name="check-circle" size={20} color="success" />
        ) : (
          <Button size="sm" variant="secondary" label={state === 'denied' ? t('notifications.open_settings') : t('notifications.enable')} onPress={() => (state === 'denied' ? void Linking.openSettings() : void request())} />
        )}
      </Row>
    </Section>
  );
}

function Section({ title, hint, children }: { title: string; hint?: string; children: ReactNode }) {
  const { spacing } = useTheme();
  return (
    <View style={{ gap: spacing.sm }}>
      <Text variant="overline" color="textSecondary" accessibilityRole="header" style={{ paddingHorizontal: spacing.xs }}>{title.toUpperCase()}</Text>
      <Card padding="md" style={{ gap: 0, paddingVertical: spacing.xs }}>{children}</Card>
      {hint ? <Text variant="caption" color="textTertiary" style={{ paddingHorizontal: spacing.xs }}>{hint}</Text> : null}
    </View>
  );
}

/** Label on the left, control on the right. */
function Row({ icon, label, sub, children }: { icon: IconName; label: string; sub?: string; children: ReactNode }) {
  const { colors, spacing, radius } = useTheme();
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.md, minHeight: 56, paddingVertical: spacing.xs }}>
      <View style={{ width: 36, height: 36, borderRadius: radius.md, backgroundColor: colors.primarySoft, alignItems: 'center', justifyContent: 'center' }}>
        <Icon name={icon} size={17} />
      </View>
      <View style={{ flex: 1, gap: 2 }}>
        <Text variant="subheading">{label}</Text>
        {sub ? <Text variant="caption" color="textSecondary">{sub}</Text> : null}
      </View>
      {children}
    </View>
  );
}

/** Label on top, a wrap of choices below. */
function Stacked({ icon, label, hint, children }: { icon: IconName; label: string; hint?: string; children: ReactNode }) {
  const { spacing } = useTheme();
  return (
    <View style={{ gap: spacing.sm, paddingVertical: spacing.md }}>
      <Row icon={icon} label={label} sub={hint}>
        {null}
      </Row>
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm, paddingLeft: 48 }}>{children}</View>
    </View>
  );
}

function Divider() {
  const { colors } = useTheme();
  return <View style={{ height: 1, backgroundColor: colors.border }} />;
}
