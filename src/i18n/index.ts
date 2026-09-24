import { getLocales } from 'expo-localization';
import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';

import en from './en.json';
import th from './th.json';

export const resources = { th: { translation: th }, en: { translation: en } } as const;
export type Locale = keyof typeof resources;

const deviceLang = getLocales()[0]?.languageCode ?? 'th';
const initialLocale: Locale = deviceLang === 'en' ? 'en' : 'th';

// eslint-disable-next-line import/no-named-as-default-member
void i18n.use(initReactI18next).init({
  resources,
  lng: initialLocale,
  fallbackLng: 'th',
  interpolation: { escapeValue: false },
});

export default i18n;
