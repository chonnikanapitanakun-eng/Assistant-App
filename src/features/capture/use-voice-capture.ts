import type { ExpoSpeechRecognitionModule as SpeechModule } from 'expo-speech-recognition';
import { useCallback, useEffect, useRef, useState } from 'react';

import { joinTranscript, speechErrorKind, speechLocale, type SpeechErrorKind, type SpeechLang } from './speech';

// The native module is missing in Expo Go and older builds — `requireNativeModule` throws at import,
// so load it lazily and treat a failure as "voice not available" instead of crashing the sheet.
let speech: typeof SpeechModule | null = null;
try {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  speech = require('expo-speech-recognition').ExpoSpeechRecognitionModule;
} catch {
  speech = null;
}

export type VoiceState = 'idle' | 'starting' | 'listening';

/**
 * Speech-to-text for Quick Capture (Thai / English).
 * Live results are appended to whatever was already typed when the mic was pressed.
 */
export function useVoiceCapture(onText: (value: string) => void) {
  const [state, setState] = useState<VoiceState>('idle');
  const [error, setError] = useState<SpeechErrorKind | null>(null);
  const baseRef = useRef('');
  const onTextRef = useRef(onText);
  useEffect(() => {
    onTextRef.current = onText;
  }, [onText]);

  const available = !!speech && safeAvailable();

  useEffect(() => {
    if (!speech) return;
    const subs = [
      speech.addListener('start', () => setState('listening')),
      speech.addListener('end', () => setState('idle')),
      speech.addListener('result', (e) => {
        const transcript = e.results[0]?.transcript ?? '';
        onTextRef.current(joinTranscript(baseRef.current, transcript));
      }),
      speech.addListener('nomatch', () => setError('no_speech')),
      speech.addListener('error', (e) => {
        setState('idle');
        setError(speechErrorKind(e.error));
      }),
    ];
    return () => {
      subs.forEach((s) => s.remove());
      speech?.abort();
    };
  }, []);

  /** `base` is the text already in the box; speech is appended to it. */
  const start = useCallback(async (lang: SpeechLang, base: string) => {
    if (!speech || !safeAvailable()) {
      setError('unavailable');
      return;
    }
    setError(null);
    setState('starting');
    try {
      const permission = await speech.requestPermissionsAsync();
      if (!permission.granted) {
        setState('idle');
        setError('permission');
        return;
      }
      baseRef.current = base;
      speech.start({ lang: speechLocale[lang], interimResults: true, continuous: false, addsPunctuation: true });
    } catch (e) {
      console.warn('Voice capture failed to start:', e);
      setState('idle');
      setError('generic');
    }
  }, []);

  const stop = useCallback(() => speech?.stop(), []);

  return { available, state, listening: state !== 'idle', error, clearError: () => setError(null), start, stop };
}

function safeAvailable() {
  try {
    return speech?.isRecognitionAvailable() ?? false;
  } catch {
    return false;
  }
}
