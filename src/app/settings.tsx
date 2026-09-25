import Constants from 'expo-constants';
import { router, useLocalSearchParams } from 'expo-router';
import { useEffect, useState, type ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { Linking, Platform, TextInput, View } from 'react-native';
import { create } from 'zustand';

import { Mascot } from '@/components/brand/mascot';
import { Button, Card, Chip, Icon, IconButton, PressableScale, Screen, Text, Toggle, type IconName } from '@/components/ui';
import { authEnabled, signInWithGoogle, signOut, useSession } from '@/features/auth';
import { completeGoogleConnect, connectGoogle, disconnectGoogle, gcalEnabled, syncGoogleCalendars, useCalendarAccounts, type AuthReturn, type ConnectResult } from '@/features/google-calendar';
import { useNotificationPermission } from '@/features/notifications';
import { accountDeleteEnabled, deleteAccount, eraseLocalData, exportAllData, PRIVACY_CONTACT_EMAIL } from '@/features/privacy';
import { DEFAULT_BRIEFING } from '@/features/profile/store';
import { setLanguage } from '@/features/profile/language';
import { ALL_INTERESTS, useProfile, type Interest } from '@/features/profile/store';
import { runSync, useSyncStatus } from '@/features/sync';
import type { CalendarAccount } from '@/db';
import { useAsyncAction } from '@/lib/use-async-action';
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

      <AccountSection />

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

      <GoogleCalendarSection />

      <FxRatesSection />

      {Platform.OS !== 'web' ? (
        <>
          <NotificationsSection />
          <BriefingSection />
        </>
      ) : null}

      <Section title={t('settings.help')}>
        <PressableScale accessibilityRole="button" accessibilityLabel={t('settings.replay')} onPress={() => router.push({ pathname: '/onboarding', params: { replay: '1' } })}>
          <Row icon="play-circle" label={t('settings.replay')} sub={t('settings.replay_body')}>
            <Icon name="chevron-right" size={18} color="textTertiary" />
          </Row>
        </PressableScale>
      </Section>

      <PrivacySection />

      <View style={{ alignItems: 'center', gap: spacing.sm, paddingVertical: spacing.xl }}>
        <Mascot pose="calm" size={72} />
        <Text variant="label" color="textSecondary">Veyra · {t('settings.version', { version: Constants.expoConfig?.version ?? '—' })}</Text>
        <Text variant="caption" color="textTertiary">Your life, handled.</Text>
      </View>
    </Screen>
  );
}

type Notice = { text: string; error?: boolean } | null;

/** Sign in with Google, cloud sync status, sign out. Local data works the same either way — this
 * only turns on syncing it across devices (P2, `src/features/auth`, `src/features/sync`). */
function AccountSection() {
  const { t, i18n } = useTranslation();
  const { spacing } = useTheme();
  const session = useSession();
  const { busy, lastSyncedAt, error } = useSyncStatus();
  const [signingIn, setSigningIn] = useState(false);
  const [notice, setNotice] = useState<Notice>(null);

  if (!authEnabled) {
    return (
      <Section title={t('sync.title')}>
        <Row icon="cloud-off" label={t('sync.title')} sub={t('sync.unavailable')}>
          {null}
        </Row>
      </Section>
    );
  }

  const doSignIn = async () => {
    setSigningIn(true);
    setNotice(null);
    try {
      const r = await signInWithGoogle();
      if (r && 'error' in r) setNotice({ text: t('sync.error_failed'), error: true });
    } catch (e) {
      console.error('Sign-in failed:', e);
      setNotice({ text: t('sync.error_failed'), error: true });
    }
    setSigningIn(false);
  };

  if (!session) {
    return (
      <Section title={t('sync.title')} hint={t('sync.hint')}>
        <View style={{ paddingVertical: spacing.sm }}>
          <Button variant="secondary" icon="log-in" label={signingIn ? t('gcal.syncing') : t('sync.sign_in')} disabled={signingIn} onPress={() => void doSignIn()} />
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
  const syncSub = error
    ? t('sync.sync_error')
    : lastSyncedAt
      ? t('sync.synced_at', { time: new Date(lastSyncedAt).toLocaleString(locale, { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' }) })
      : t('sync.not_synced');

  return (
    <Section title={t('sync.title')}>
      <Row icon="user-check" label={session.user.email ?? t('sync.signed_in')} sub={syncSub}>
        {null}
      </Row>
      <Divider />
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: spacing.sm, paddingVertical: spacing.sm }}>
        <Button size="sm" variant="secondary" icon="refresh-cw" label={busy ? t('gcal.syncing') : t('sync.sync_now')} disabled={busy} onPress={() => void runSync()} />
        <Button size="sm" variant="ghost" icon="log-out" label={t('sync.sign_out')} onPress={() => void signOut()} />
      </View>
    </Section>
  );
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

/**
 * PDPA (P4-07): the policy, take your data (export), erase this device, delete the account.
 * Erase / delete are two-tap (useConfirm) and end in onboarding, since the profile is gone too.
 */
function PrivacySection() {
  const { t } = useTranslation();
  const { spacing } = useTheme();
  const session = useSession();
  const [notice, setNotice] = useState<Notice>(null);
  const exporting = useAsyncAction();
  const erasing = useAsyncAction();
  const deleting = useAsyncAction();
  const eraseArm = useConfirm();
  const deleteArm = useConfirm();
  const busy = exporting.busy || erasing.busy || deleting.busy;

  const doExport = async () => {
    setNotice(null);
    const ok = await exporting.run(exportAllData);
    setNotice({ text: ok ? t('privacy.export_done') : t('privacy.export_failed'), error: !ok });
  };
  const doErase = async () => {
    setNotice(null);
    if (await erasing.run(() => eraseLocalData())) router.replace('/onboarding');
    else setNotice({ text: t('privacy.erase_failed'), error: true });
  };
  const doDelete = async () => {
    setNotice(null);
    if (await deleting.run(deleteAccount)) router.replace('/onboarding');
    else setNotice({ text: t('privacy.delete_failed', { email: PRIVACY_CONTACT_EMAIL }), error: true });
  };

  return (
    <Section title={t('privacy.title')}>
      <PressableScale accessibilityRole="button" accessibilityLabel={t('privacy.policy')} onPress={() => router.push('/privacy')}>
        <Row icon="shield" label={t('privacy.policy')} sub={t('privacy.policy_body')}>
          <Icon name="chevron-right" size={18} color="textTertiary" />
        </Row>
      </PressableScale>
      <Divider />
      <Row icon="download" label={t('privacy.export')} sub={t('privacy.export_body')}>
        <Button size="sm" variant="secondary" label={exporting.busy ? t('common.loading') : t('privacy.export_action')} disabled={busy} onPress={() => void doExport()} />
      </Row>
      <Divider />
      <Row icon="trash-2" label={t('privacy.erase')} sub={t('privacy.erase_body')}>
        <Button size="sm" variant="ghost" label={eraseArm.armed ? t('privacy.erase_confirm') : t('privacy.erase_action')} accessibilityHint={t('privacy.erase_body')} disabled={busy} onPress={() => eraseArm.confirm(() => void doErase())} />
      </Row>
      {accountDeleteEnabled ? (
        <>
          <Divider />
          <Row icon="user-x" label={t('privacy.delete_account')} sub={session ? t('privacy.delete_account_body') : t('privacy.delete_offline')}>
            {session ? (
              <Button size="sm" variant="ghost" label={deleteArm.armed ? t('privacy.delete_confirm') : t('privacy.delete_action')} accessibilityHint={t('privacy.delete_account_body')} disabled={busy} onPress={() => deleteArm.confirm(() => void doDelete())} />
            ) : null}
          </Row>
        </>
      ) : null}
      {notice ? (
        <Text variant="caption" color={notice.error ? 'danger' : 'success'} accessibilityLiveRegion="polite" style={{ paddingBottom: spacing.sm }}>
          {notice.text}
        </Text>
      ) : null}
    </Section>
  );
}

const BRIEFING_TIMES = [
  { hour: 6, minute: 30 },
  { hour: 7, minute: 0 },
  { hour: 7, minute: 30 },
  { hour: 8, minute: 0 },
  { hour: 8, minute: 30 },
];
const hhmm = (h: number, m: number) => `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;

/** Morning briefing: on/off and the time. Turning it on asks for permission if the app never has. */
function BriefingSection() {
  const { t } = useTranslation();
  const briefing = useProfile((p) => p.briefing) ?? DEFAULT_BRIEFING;
  const update = useProfile((p) => p.update);
  const { state, request } = useNotificationPermission();
  const set = (patch: Partial<typeof briefing>) => update({ briefing: { ...briefing, ...patch } });
  const toggle = async (on: boolean) => {
    set({ enabled: on });
    if (!on) return;
    if (state === 'denied') void Linking.openSettings();
    else if (state === 'undetermined') await request();
  };
  const blocked = briefing.enabled && state === 'denied';
  return (
    <Section title={t('settings.briefing')} hint={t('settings.briefing_hint')}>
      <Row icon="sunrise" label={t('settings.briefing')} sub={blocked ? t('settings.notify_denied') : t('settings.briefing_body')}>
        <Toggle value={briefing.enabled} onValueChange={(v) => void toggle(v)} label={t('settings.briefing')} />
      </Row>
      {briefing.enabled ? (
        <>
          <Divider />
          <Stacked icon="clock" label={t('settings.briefing_time')}>
            {BRIEFING_TIMES.map((x) => (
              <Chip key={hhmm(x.hour, x.minute)} label={hhmm(x.hour, x.minute)} selected={briefing.hour === x.hour && briefing.minute === x.minute} onPress={() => set(x)} />
            ))}
          </Stacked>
        </>
      ) : null}
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
