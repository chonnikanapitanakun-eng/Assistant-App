import * as Notifications from 'expo-notifications';
import { Platform } from 'react-native';

import { readJSON, writeJSON } from '@/features/profile/storage';

import type { BriefingPlan } from './briefing-model';
import { getPermissionState } from './permissions';
import { BRIEFING_CHANNEL_ID } from './setup';

export { BRIEFING_DAYS, briefingBody, briefingTimes, type BriefingCounts, type BriefingPlan } from './briefing-model';

/** Route opened when the user taps a briefing. */
export const BRIEFING_URL = '/review';

type Stored = { ids: string[]; fingerprint: string };
const KEY = 'veyra.briefing';

/**
 * Make the scheduled briefings match `plans` (empty = none): cancel the previous set, schedule the new one,
 * remember the ids. Skips the work when nothing changed. Never prompts for permission — Settings does that.
 * Never throws.
 */
export async function syncMorningBriefing(plans: BriefingPlan[]): Promise<void> {
  if (Platform.OS === 'web') return;
  const stored = readJSON<Stored>(KEY) ?? { ids: [], fingerprint: '' };
  const granted = (await getPermissionState().catch(() => 'denied')) === 'granted';
  const wanted = granted ? plans : [];
  const fingerprint = JSON.stringify(wanted.map((p) => [p.at, p.title, p.body]));
  if (fingerprint === stored.fingerprint) return;

  await Promise.all(stored.ids.map((id) => Notifications.cancelScheduledNotificationAsync(id).catch(() => undefined)));
  const ids: string[] = [];
  for (const p of wanted) {
    const id = await Notifications.scheduleNotificationAsync({
      content: { title: p.title, body: p.body, sound: false, data: { url: BRIEFING_URL, date: p.date } },
      trigger: { type: Notifications.SchedulableTriggerInputTypes.DATE, date: p.at, channelId: BRIEFING_CHANNEL_ID },
    }).catch(() => null);
    if (id) ids.push(id);
  }
  writeJSON(KEY, { ids, fingerprint } satisfies Stored);
}
