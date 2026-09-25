/**
 * QRs printed on Thai e-slips, both EMVCo-style TLV. Neither carries the amount, but they are free to
 * read on the device and give the ref — a duplicate is caught before any paid call.
 *   Bank slips (Bank of Thailand slip-verification "mini QR", e.g. K PLUS):
 *     00 → { 00: API id "000001", 01: sending bank code, 02: transaction ref }, 51 → "TH", 91 → CRC
 *   TrueMoney Wallet slips:
 *     00 → { 00: "01", 01: "01", 02: type ("P2P"…), 03: transaction ID, 04: date DDMMYYYY }, 91 → CRC
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
  if (!inner) return null;
  if (inner.get('00') === '01') {
    const id = inner.get('03') ?? '';
    return /^\d{10,}$/.test(id) && /^\d{8}$/.test(inner.get('04') ?? '') ? { bankCode: 'TMN', ref: id } : null;
  }
  if (inner.get('00') !== '000001') return null;
  const bankCode = inner.get('01') ?? '';
  const ref = inner.get('02') ?? '';
  if (!/^\d{3}$/.test(bankCode) || ref.length < 6) return null;
  return { bankCode, ref };
}
