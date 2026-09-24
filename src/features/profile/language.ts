import i18n from '@/i18n';

import { useProfile } from './store';

/** Switch the UI language now and remember it. */
export function setLanguage(language: 'en' | 'th') {
  void i18n.changeLanguage(language);
  useProfile.getState().update({ language });
}
