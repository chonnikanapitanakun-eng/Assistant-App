/**
 * The QR printed on Thai bank e-slips (Bank of Thailand slip-verification "mini QR") — EMVCo-style TLV:
 *   00 → nested TLV { 00: API id "000001", 01: sending bank code, 02: transaction ref }
 *   51 → country "TH", 91 → CRC
 * It carries no amount, but it is free to read on the device and gives the ref (duplicate check
 * before any paid call) and the payer's bank (wallet matching).
 */
export type SlipQr = { bankCode: string; ref: string };

function tlv(payload: string): Map<string, string> | null {
  const out = new Map<string, string>();
  let i = 0;
  while (i < payload.length) {
    const tag = payload.slice(i, i + 2);
    const len = Number(payload.slice(i + 2, i + 4));
    if (!/^\d{2}$/.test(tag) || !Number.isInteger(len) || i + 4 + len > payload.length) return null;
    out.set(tag, payload.slice(i + 4, i + 4 + len));
    i += 4 + len;
  }
  return out;
}

export function parseSlipQr(data: string | null | undefined): SlipQr | null {
  if (!data) return null;
  const top = tlv(data.trim());
  const inner = top?.get('00') ? tlv(top.get('00')!) : null;
  if (!inner || inner.get('00') !== '000001') return null;
  const bankCode = inner.get('01') ?? '';
  const ref = inner.get('02') ?? '';
  if (!/^\d{3}$/.test(bankCode) || ref.length < 6) return null;
  return { bankCode, ref };
}
