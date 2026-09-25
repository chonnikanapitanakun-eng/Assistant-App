export type SpeechLang = 'th' | 'en';

/** BCP-47 locale per capture language. English is British — most of Proud's English work is UK clients. */
export const speechLocale: Record<SpeechLang, string> = { th: 'th-TH', en: 'en-GB' };

/** Default voice language: follow the UI language. */
export function defaultSpeechLang(uiLanguage: string | undefined): SpeechLang {
  return uiLanguage?.startsWith('th') ? 'th' : 'en';
}

/** Append a spoken transcript to what was already typed, with a single space between. */
export function joinTranscript(base: string, transcript: string): string {
  const spoken = transcript.trim();
  if (!spoken) return base;
  const typed = base.trimEnd();
  return typed ? `${typed} ${spoken}` : spoken;
}

export type SpeechErrorKind = 'permission' | 'no_speech' | 'language' | 'network' | 'unavailable' | 'generic';

/** Map the recognizer's error code onto the messages the capture sheet shows. `null` = user cancelled, stay quiet. */
export function speechErrorKind(code: string): SpeechErrorKind | null {
  switch (code) {
    case 'aborted':
      return null;
    case 'not-allowed':
      return 'permission';
    case 'no-speech':
    case 'speech-timeout':
      return 'no_speech';
    case 'language-not-supported':
      return 'language';
    case 'network':
      return 'network';
    case 'service-not-allowed':
    case 'audio-capture':
      return 'unavailable';
    default:
      return 'generic';
  }
}
