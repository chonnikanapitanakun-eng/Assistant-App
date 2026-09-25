import * as ImagePicker from 'expo-image-picker';
import { router } from 'expo-router';
import { useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ScrollView, View } from 'react-native';

import { Mascot } from '@/components/brand/mascot';
import { Button, FieldError, Sheet, Text } from '@/components/ui';
import { createSlipTransactions, getPayeeHistory, getSlipRefs, useCategories, useWallets } from '@/features/money/queries';
import { SlipCard } from '@/features/slip/components/slip-card';
import { applyScan, draftErrors, emptyDraft, hasErrors, toValues, type SlipDraft } from '@/features/slip/draft';
import { suggestFromSlip, type PayeeHistory } from '@/features/slip/match';
import { slipRemoteEnabled } from '@/features/slip/remote';
import { scanSlip } from '@/features/slip/scan';
import { toDateKey } from '@/lib/date';
import { newId } from '@/lib/ids';
import { useAsyncAction } from '@/lib/use-async-action';
import { useTheme } from '@/theme';

const MAX_PER_BATCH = 20;

/**
 * Slip OCR (P3-04): pick or shoot bank slips → read each one (slip QR on the device, then Claude Haiku)
 * → match account + category from rules and history → the user confirms → saved with source 'slip'.
 */
export default function SlipScreen() {
  const { t } = useTranslation();
  const { spacing } = useTheme();
  const wallets = useWallets();
  const categories = useCategories();
  const { busy, failed, run } = useAsyncAction();
  const [drafts, setDrafts] = useState<SlipDraft[]>([]);
  const [showErrors, setShowErrors] = useState(false);
  const [pickError, setPickError] = useState<string | null>(null);
  const abort = useRef<AbortController | null>(null);
  const sessionRefs = useRef(new Set<string>()); // refs read on this screen, across batches
  const walletsRef = useRef(wallets);
  useEffect(() => {
    walletsRef.current = wallets; // read by the scan loop, which outlives a render
  }, [wallets]);
  useEffect(() => () => abort.current?.abort(), []);

  const close = () => (router.canGoBack() ? router.back() : router.replace('/money'));
  const patch = (key: string, p: Partial<SlipDraft>) => setDrafts((all) => all.map((d) => (d.key === key ? { ...d, ...p } : d)));

  const scanning = drafts.some((d) => d.status === 'scanning');
  const chosen = drafts.filter((d) => d.include);

  async function process(added: SlipDraft[]) {
    abort.current ??= new AbortController();
    const signal = abort.current.signal;
    // Refs already saved + refs read on this screen: the same slip twice is flagged before any paid call.
    const known = await getSlipRefs();
    for (const ref of sessionRefs.current) known.add(ref);
    const history: PayeeHistory[] = await getPayeeHistory();

    for (const d of added) {
      if (signal.aborted) return;
      const outcome = await scanSlip({ uri: d.uri, width: d.width }, known, signal);
      const all = walletsRef.current;
      const fallback = all.find((w) => w.currency === 'THB')?.id ?? all[0]?.id ?? null;
      const next = applyScan(d, outcome, (slip) => suggestFromSlip(slip, all, history), fallback);
      if (next.slipRef) {
        known.add(next.slipRef);
        sessionRefs.current.add(next.slipRef);
      }
      // A card is not editable while scanning, so the scan result replaces it wholesale.
      setDrafts((cur) => cur.map((x) => (x.key === d.key ? next : x)));
    }
  }

  async function pick(source: 'library' | 'camera') {
    setPickError(null);
    const options: ImagePicker.ImagePickerOptions = { mediaTypes: ['images'], quality: 1 };
    let result: ImagePicker.ImagePickerResult;
    if (source === 'camera') {
      const perm = await ImagePicker.requestCameraPermissionsAsync();
      if (!perm.granted) return setPickError(t('slip.camera_denied'));
      result = await ImagePicker.launchCameraAsync(options);
    } else {
      result = await ImagePicker.launchImageLibraryAsync({ ...options, allowsMultipleSelection: true, selectionLimit: MAX_PER_BATCH, orderedSelection: true });
    }
    if (result.canceled || !result.assets.length) return;
    const today = toDateKey();
    const added = result.assets.slice(0, MAX_PER_BATCH).map((a) => emptyDraft(newId(), a.uri, today, a.width || undefined));
    setDrafts((cur) => [...cur, ...added]);
    void process(added);
  }

  const save = () => {
    if (chosen.some((d) => hasErrors(draftErrors(d)))) {
      setShowErrors(true);
      return;
    }
    void run(async () => {
      await createSlipTransactions(chosen.map(toValues));
      close();
    });
  };

  return (
    <Sheet
      onClose={close}
      wide="side"
      title={t('slip.title')}
      subtitle={drafts.length ? t('slip.count', { count: drafts.length }) : undefined}
      footer={
        drafts.length ? (
          <View style={{ gap: spacing.sm }}>
            <FieldError message={failed ? t('common.save_failed') : showErrors ? t('slip.fix_errors') : pickError} />
            <Button fullWidth icon="check" label={t('slip.save', { count: chosen.length })} disabled={busy || scanning || !chosen.length} onPress={save} />
            <View style={{ flexDirection: 'row', gap: spacing.sm }}>
              <View style={{ flex: 1 }}>
                <Button fullWidth variant="secondary" size="sm" icon="image" label={t('slip.add_more')} disabled={busy} onPress={() => void pick('library')} />
              </View>
              <View style={{ flex: 1 }}>
                <Button fullWidth variant="secondary" size="sm" icon="camera" label={t('slip.take_photo')} disabled={busy} onPress={() => void pick('camera')} />
              </View>
            </View>
          </View>
        ) : undefined
      }
    >
      <ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={{ padding: spacing.xl, gap: spacing.lg }}>
        {drafts.length ? (
          drafts.map((d) => <SlipCard key={d.key} draft={d} wallets={wallets} categories={categories} showErrors={showErrors} onChange={(p) => patch(d.key, p)} />)
        ) : (
          <View style={{ alignItems: 'center', gap: spacing.lg, paddingVertical: spacing.lg }}>
            <Mascot pose="search" size={104} />
            <Text variant="body" color="textSecondary" align="center">{t('slip.intro')}</Text>
            {!slipRemoteEnabled ? <Text variant="caption" color="textTertiary" align="center">{t('slip.needs_setup')}</Text> : null}
            <View style={{ alignSelf: 'stretch', gap: spacing.sm }}>
              <Button fullWidth icon="image" label={t('slip.pick_gallery')} onPress={() => void pick('library')} />
              <Button fullWidth variant="secondary" icon="camera" label={t('slip.take_photo')} onPress={() => void pick('camera')} />
            </View>
            <FieldError message={pickError} />
          </View>
        )}
      </ScrollView>
    </Sheet>
  );
}
