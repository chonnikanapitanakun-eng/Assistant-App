import { describe, expect, it } from 'vitest';

import { defaultSpeechLang, joinTranscript, speechErrorKind } from '../speech';

describe('joinTranscript', () => {
  it('uses the transcript alone when nothing was typed', () => {
    expect(joinTranscript('', ' ข้าวเที่ยง 120 ')).toBe('ข้าวเที่ยง 120');
  });
  it('appends to typed text with one space', () => {
    expect(joinTranscript('Meeting with John ', 'tomorrow at 10')).toBe('Meeting with John tomorrow at 10');
  });
  it('keeps typed text when the transcript is empty', () => {
    expect(joinTranscript('draft', '  ')).toBe('draft');
  });
});

describe('defaultSpeechLang', () => {
  it('follows the UI language', () => {
    expect(defaultSpeechLang('th')).toBe('th');
    expect(defaultSpeechLang('th-TH')).toBe('th');
    expect(defaultSpeechLang('en')).toBe('en');
    expect(defaultSpeechLang(undefined)).toBe('en');
  });
});

describe('speechErrorKind', () => {
  it('stays quiet when the user cancels', () => {
    expect(speechErrorKind('aborted')).toBeNull();
  });
  it('maps permission and silence errors', () => {
    expect(speechErrorKind('not-allowed')).toBe('permission');
    expect(speechErrorKind('no-speech')).toBe('no_speech');
    expect(speechErrorKind('language-not-supported')).toBe('language');
    expect(speechErrorKind('busy')).toBe('generic');
  });
});
