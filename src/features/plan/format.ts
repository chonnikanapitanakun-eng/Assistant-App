import { fromDateKey } from '@/lib/calendar';

/** th → ปฏิทินไทย (พ.ศ.) อัตโนมัติจาก Intl */
const locale = (lang: string) => (lang.startsWith('th') ? 'th-TH' : 'en-GB');

export const formatDate = (key: string, lang: string, options: Intl.DateTimeFormatOptions) =>
  fromDateKey(key).toLocaleDateString(locale(lang), options);
