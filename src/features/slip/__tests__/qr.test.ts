import { describe, expect, it } from 'vitest';

import { parseSlipQr } from '../qr';

// 00 → [00 "000001", 01 "004", 02 25-char ref], 51 "TH", 91 CRC
const ref = '016268140512BPM01234ABCDE';
const inner = `0006000001` + `0103004` + `02${String(ref.length).padStart(2, '0')}${ref}`;
const slipQr = `00${String(inner.length).padStart(2, '0')}${inner}5102TH91041A2B`;

describe('parseSlipQr', () => {
  it('reads bank code and ref from a slip QR', () => {
    expect(parseSlipQr(slipQr)).toEqual({ bankCode: '004', ref });
  });

  it('ignores PromptPay payment QRs, URLs and broken payloads', () => {
    expect(parseSlipQr('00020101021129370016A000000677010111011300668123456785802TH53037646304ABCD')).toBeNull();
    expect(parseSlipQr('https://example.com')).toBeNull();
    expect(parseSlipQr(slipQr.slice(0, 20))).toBeNull();
    expect(parseSlipQr('')).toBeNull();
    expect(parseSlipQr(null)).toBeNull();
  });
});
