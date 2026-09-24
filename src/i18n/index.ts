import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';

import { loadProfile } from '@/features/profile/store';

import en from './en.json';
import th from './th.json';

export const resources = { th: { translation: th }, en: { translation: en } } as const;
export type Locale = keyof typeof resources;

// The saved profile language wins; otherwise the device language (see profile/store).
const initialLocale: Locale = loadProfile().language;

// eslint-disable-next-line import/no-named-as-default-member
void i18n.use(initReactI18next).init({
  resources,
  lng: initialLocale,
  fallbackLng: 'th',
  interpolation: { escapeValue: false },
});

export default i18n;
