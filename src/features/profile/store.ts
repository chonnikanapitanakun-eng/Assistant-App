import { getLocales } from 'expo-localization';
import { create } from 'zustand';

import type { Currency } from '@/lib/currency';

import { readJSON, writeJSON } from './storage';

export type Interest = 'tasks' | 'calendar' | 'money' | 'notes' | 'focus';
export const ALL_INTERESTS: Interest[] = ['tasks', 'calendar', 'money', 'notes', 'focus'];

export type Profile = {
  name: string;
  language: 'en' | 'th';
  currency: Currency;
  interests: Interest[];
  onboarded: boolean;
  /** How many units of `currency` (the primary) equal 1 unit of each other currency. Set by hand in Settings. */
  fxRates: Partial<Record<Currency, number>>;
  /** Context-aware reminders (P3-07): minutes before an event to flag unfinished prep. 0 = off. */
  contextReminderMin: number;
};

export const PROFILE_KEY = 'veyra.profile';

const deviceLanguage = (): 'en' | 'th' => (getLocales()[0]?.languageCode === 'th' ? 'th' : 'en');

export function defaultProfile(): Profile {
  return { name: '', language: deviceLanguage(), currency: 'THB', interests: [...ALL_INTERESTS], onboarded: false, fxRates: {}, contextReminderMin: 30 };
}

export function loadProfile(): Profile {
  return { ...defaultProfile(), ...(readJSON<Partial<Profile>>(PROFILE_KEY) ?? {}) };
}

type Store = Profile & { update: (patch: Partial<Profile>) => void };

/** The user's profile, persisted on device. Read with `useProfile((p) => p.name)`. */
export const useProfile = create<Store>((set, get) => ({
  ...loadProfile(),
  update: (patch) => {
    set(patch);
    const { update: _u, ...profile } = get();
    writeJSON(PROFILE_KEY, profile);
  },
}));

/** Non-hook read for non-React code (e.g. money defaults). */
export const primaryCurrency = (): Currency => useProfile.getState().currency;
export const usePrimaryCurrency = () => useProfile((p) => p.currency);
export const useFxRates = () => useProfile((p) => p.fxRates);
