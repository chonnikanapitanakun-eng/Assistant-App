import Constants from 'expo-constants';
import { router, useLocalSearchParams } from 'expo-router';
import { useEffect, useState, type ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { Linking, Platform, TextInput, View } from 'react-native';
import { create } from 'zustand';

import { Mascot } from '@/components/brand/mascot';
import { Button, Card, Chip, Icon, IconButton, PressableScale, Screen, Text, Toggle, type IconName } from '@/components/ui';
import { AuthError, authEnabled, signIn, signOut, useAuth, type Provider } from '@/features/auth';
import { completeGoogleConnect, connectGoogle, disconnectGoogle, gcalEnabled, syncGoogleCalendars, useCalendarAccounts, type AuthReturn, type ConnectResult } from '@/features/google-calendar';
import { useNotificationPermission } from '@/features/notifications';
import { setLanguage } from '@/features/profile/language';
import { ALL_INTERESTS, useProfile, type Interest } from '@/features/profile/store';
import { syncNow, useSyncStatus } from '@/features/sync';
import type { CalendarAccount } from '@/db';
import { useConfirm } from '@/lib/use-confirm';
import { currencySymbol, parseAmount, supportedCurrencies, type Currency } from '@/lib/currency';
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

      <AccountSection />

      <GoogleCalendarSection />

      <FxRatesSection />

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

type Notice = { text: string; error?: boolean } | null;

/** Sign-in state and the last sync result, outside the component: on web the OAuth redirect remounts Settings. */
const useAccountUi = create<{ busy: boolean; notice: Notice }>(() => ({ busy: false, notice: null }));
let accountNoticeTimer: ReturnType<typeof setTimeout> | undefined;

/** Supabase Auth (Apple / Google) + cloud sync (P2-08). Data stays local-first; this only backs it up and shares it between devices. */
function AccountSection() {
  const { t, i18n } = useTranslation();
  const { colors, spacing } = useTheme();
  const { status, user } = useAuth();
  const sync = useSyncStatus();
  const { busy, notice } = useAccountUi();
  const { armed, confirm } = useConfirm();
  const params = useLocalSearchParams<{ code?: string; error?: string; error_description?: string }>();

  // Web: back from the provider as /settings?code=… (supabase-js has already used it) or ?error=….
  const { code, error: oauthError, error_description: oauthErrorText } = params;
  useEffect(() => {
    if (!code && !oauthError) return;
    router.replace('/settings');
    if (oauthError) showAccountNotice({ text: /denied|cancel/i.test(oauthErrorText ?? oauthError) ? t('account.error_cancelled') : t('account.error_failed'), error: true });
    // eslint-disable-next-line react-hooks/exhaustive-deps -- once per redirect
  }, [code, oauthError]);

  if (!authEnabled) {
    return (
      <Section title={t('account.title')}>
        <Row icon="cloud" label={t('account.title')} sub={t('account.unavailable')}>
          {null}
        </Row>
      </Section>
    );
  }

  const act = async (work: () => Promise<void>, failText: (e: unknown) => string) => {
    clearTimeout(accountNoticeTimer);
    useAccountUi.setState({ busy: true, notice: null });
    let next: Notice = null;
    try {
      await work();
    } catch (e) {
      console.error('Account action failed:', e);
      next = { text: failText(e), error: true };
    }
    useAccountUi.setState({ busy: false });
    if (next) showAccountNotice(next);
  };
  const signInError = (e: unknown) => t(`account.error_${e instanceof AuthError ? e.code : 'failed'}`);
  const start = (provider: Provider) => void act(() => signIn(provider), signInError);

  if (status !== 'signed_in' || !user) {
    return (
      <Section title={t('account.title')} hint={t('account.hint')}>
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: spacing.sm, paddingVertical: spacing.sm }}>
          <Button size="sm" variant="secondary" label={busy ? t('account.signing_in') : t('account.sign_in_apple')} disabled={busy || status === 'loading'} onPress={() => start('apple')} />
          <Button size="sm" variant="secondary" label={busy ? t('account.signing_in') : t('account.sign_in_google')} disabled={busy || status === 'loading'} onPress={() => start('google')} />
        </View>
        {notice ? (
          <Text variant="caption" color={notice.error ? 'danger' : 'success'} accessibilityLiveRegion="polite" style={{ paddingBottom: spacing.sm }}>
            {notice.text}
          </Text>
        ) : null}
      </Section>
    );
  }

  const locale = i18n.language === 'th' ? 'th-TH' : 'en-GB';
  const syncLabel = sync.busy
    ? t('account.syncing')
    : sync.error
      ? t('account.sync_error')
      : sync.lastSyncedAt
        ? t('account.synced_at', { time: new Date(sync.lastSyncedAt).toLocaleString(locale, { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' }) })
        : t('account.not_synced');
  return (
    <Section title={t('account.title')} hint={t('account.sign_out_hint')}>
      <Row icon="user" label={user.email ?? t('account.signed_in')}>
        {null}
      </Row>
      <Divider />
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: spacing.sm, paddingVertical: spacing.sm }}>
        <Button size="sm" variant="secondary" icon="refresh-cw" label={sync.busy ? t('account.syncing') : t('account.sync_now')} disabled={sync.busy || busy} onPress={() => void act(() => syncNow({ force: true }), () => t('account.sync_error'))} />
        <Button size="sm" variant="ghost" icon="log-out" label={armed ? t('account.sign_out_confirm') : t('account.sign_out')} disabled={busy} onPress={() => confirm(() => void act(signOut, () => t('account.error_failed')))} />
        <Text variant="caption" tone={sync.error ? colors.danger : colors.textSecondary} style={{ flexBasis: '100%' }}>{syncLabel}</Text>
      </View>
      {notice ? (
        <Text variant="caption" color={notice.error ? 'danger' : 'success'} accessibilityLiveRegion="polite" style={{ paddingBottom: spacing.sm }}>
          {notice.text}
        </Text>
      ) : null}
    </Section>
  );
}

function showAccountNotice(notice: Notice) {
  clearTimeout(accountNoticeTimer);
  useAccountUi.setState({ notice });
  accountNoticeTimer = setTimeout(() => useAccountUi.setState({ notice: null }), 8000);
}

/** Busy flag + last result, outside the component so they survive Settings remounting after the OAuth redirect. */
const useGcalUi = create<{ busy: boolean; notice: Notice }>(() => ({ busy: false, notice: null }));
let noticeTimer: ReturnType<typeof setTimeout> | undefined;

const GCAL_ERRORS = ['denied', 'scope', 'too_many_accounts', 'not_configured'];

/** Linked Google accounts (P2-07): add, re-link, remove, sync now. Imported events are read-only. */
function GoogleCalendarSection() {
  const { t, i18n } = useTranslation();
  const { spacing } = useTheme();
  const accounts = useCalendarAccounts();
  const params = useLocalSearchParams<AuthReturn>();
  const { busy, notice } = useGcalUi();

  const errorText = (code: string) => t(`gcal.error_${GCAL_ERRORS.includes(code) ? code : 'failed'}`);
  const act = async (work: () => Promise<ConnectResult | void>) => {
    clearTimeout(noticeTimer);
    useGcalUi.setState({ busy: true, notice: null });
    let next: Notice = null;
    try {
      const r = await work();
      if (r && 'email' in r) next = { text: t('gcal.linked', { email: r.email }) };
      else if (r && 'error' in r) next = { text: errorText(r.error), error: true };
    } catch (e) {
      console.error('Google Calendar failed:', e);
      next = { text: errorText(e instanceof Error ? e.message : ''), error: true };
    }
    useGcalUi.setState({ busy: false, notice: next });
    noticeTimer = setTimeout(() => useGcalUi.setState({ notice: null }), 8000);
  };

  // Back from Google (web, or Android's deep link): ?gcal=<ticket> | ?gcal_error=<code>.
  const { gcal, gcal_error } = params;
  useEffect(() => {
    if (!gcal && !gcal_error) return;
    // Drop the params so a reload doesn't re-claim a used ticket. This remounts the screen, hence the store.
    router.replace('/settings');
    void act(() => completeGoogleConnect({ gcal, gcal_error }));
    // eslint-disable-next-line react-hooks/exhaustive-deps -- once per redirect; `act` only sets local state
  }, [gcal, gcal_error]);

  if (!gcalEnabled) {
    return (
      <Section title={t('gcal.title')}>
        <Row icon="calendar" label={t('gcal.title')} sub={t('gcal.unavailable')}>
          {null}
        </Row>
      </Section>
    );
  }

  const locale = i18n.language === 'th' ? 'th-TH' : 'en-GB';
  return (
    <Section title={t('gcal.title')} hint={t('gcal.hint')}>
      {accounts.map((a, idx) => (
        <View key={a.id}>
          {idx ? <Divider /> : null}
          <AccountRow account={a} locale={locale} busy={busy} onReconnect={() => void act(() => connectGoogle(a.email))} onRemove={() => void act(() => disconnectGoogle(a.id))} />
        </View>
      ))}
      {accounts.length ? <Divider /> : null}
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: spacing.sm, paddingVertical: spacing.sm }}>
        <Button size="sm" variant="secondary" icon="plus" label={accounts.length ? t('gcal.add_another') : t('gcal.add')} disabled={busy} onPress={() => void act(() => connectGoogle())} />
        {accounts.length ? <Button size="sm" variant="ghost" icon="refresh-cw" label={busy ? t('gcal.syncing') : t('gcal.sync_now')} disabled={busy} onPress={() => void act(() => syncGoogleCalendars({ force: true }))} /> : null}
      </View>
      {notice ? (
        <Text variant="caption" color={notice.error ? 'danger' : 'success'} accessibilityLiveRegion="polite" style={{ paddingBottom: spacing.sm }}>
          {notice.text}
        </Text>
      ) : null}
    </Section>
  );
}

function AccountRow({ account, locale, busy, onReconnect, onRemove }: { account: CalendarAccount; locale: string; busy: boolean; onReconnect: () => void; onRemove: () => void }) {
  const { t } = useTranslation();
  const { colors, spacing } = useTheme();
  const { armed, confirm } = useConfirm();
  const sub =
    account.status === 'reauth'
      ? t('gcal.needs_reauth')
      : account.status === 'error'
        ? t('gcal.sync_error')
        : account.lastSyncedAt
          ? t('gcal.synced_at', { time: new Date(account.lastSyncedAt).toLocaleString(locale, { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' }) })
          : t('gcal.not_synced');
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.md, minHeight: 56, paddingVertical: spacing.xs }}>
      <View style={{ width: 36, alignItems: 'center' }}>
        <View style={{ width: 12, height: 12, borderRadius: 6, backgroundColor: account.color }} />
      </View>
      <View style={{ flex: 1, minWidth: 0, gap: 2 }}>
        <Text variant="subheading" numberOfLines={1}>{account.email}</Text>
        <Text variant="caption" tone={account.status === 'ok' ? colors.textSecondary : colors.danger}>{sub}</Text>
      </View>
      {account.status === 'reauth' ? <Button size="sm" variant="secondary" label={t('gcal.reconnect')} disabled={busy} onPress={onReconnect} /> : null}
      <Button size="sm" variant="ghost" label={armed ? t('gcal.remove_confirm') : t('gcal.remove')} accessibilityHint={t('gcal.remove_hint', { email: account.email })} disabled={busy} onPress={() => confirm(onRemove)} />
    </View>
  );
}

function FxRatesSection() {
  const { t } = useTranslation();
  const { colors, spacing, radius, typography, fontFamily } = useTheme();
  const profile = useProfile();
  const others = supportedCurrencies.filter((c) => c !== profile.currency);
  const [drafts, setDrafts] = useState<Partial<Record<Currency, string>>>({});

  if (!others.length) return null;

  const commit = (currency: Currency, text: string) => {
    const n = parseAmount(text);
    profile.update({ fxRates: { ...profile.fxRates, [currency]: n && n > 0 ? n : undefined } });
  };

  return (
    <Section title={t('settings.fx_rates')} hint={t('settings.fx_rates_hint')}>
      {others.map((c, idx) => (
        <View key={c}>
          {idx ? <Divider /> : null}
          <Row icon="repeat" label={t('settings.fx_rate_label', { currency: c })}>
            <TextInput
              value={drafts[c] ?? (profile.fxRates[c] ? String(profile.fxRates[c]) : '')}
              onChangeText={(v) => setDrafts((d) => ({ ...d, [c]: v }))}
              onBlur={() => commit(c, drafts[c] ?? '')}
              keyboardType="decimal-pad"
              placeholder={t('settings.fx_rate_placeholder')}
              placeholderTextColor={colors.textTertiary}
              accessibilityLabel={t('settings.fx_rate_label', { currency: c })}
              style={{ minWidth: 0, width: 110, minHeight: 44, textAlign: 'right', paddingHorizontal: spacing.md, borderRadius: radius.md, borderWidth: 1.5, borderColor: colors.border, backgroundColor: colors.surfaceMuted, color: colors.text, fontSize: typography.body.fontSize, fontFamily: fontFamily.medium }}
            />
          </Row>
        </View>
      ))}
    </Section>
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
