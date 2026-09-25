import { getSession } from '@/features/auth';

import type { SlipParty, SlipResult } from './types';

const url = process.env.EXPO_PUBLIC_SUPABASE_URL;
const anonKey = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY;

/** Slip reading runs only when the Supabase project is configured (see supabase/functions/slip-ocr). */
export const slipRemoteEnabled = !!url && !!anonKey;

const isDate = (v: unknown): v is string => typeof v === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(v);
const str = (v: unknown) => (typeof v === 'string' && v ? v : undefined);
const party = (v: unknown): SlipParty => {
  const p = v && typeof v === 'object' ? (v as Record<string, unknown>) : {};
  return { name: str(p.name), bankCode: str(p.bankCode), accountDigits: str(p.accountDigits) };
};

/** Send one resized JPEG (base64) to `slip-ocr`. Throws on network / HTTP errors. */
export async function readSlipRemote(base64: string, signal?: AbortSignal): Promise<SlipResult> {
  const res = await fetch(`${url}/functions/v1/slip-ocr`, {
    method: 'POST',
    headers: { 'content-type': 'application/json', authorization: `Bearer ${getSession()?.access_token ?? anonKey}`, apikey: anonKey! },
    signal,
    body: JSON.stringify({ image: base64 }),
  });
  if (!res.ok) throw new Error(`slip-ocr ${res.status}`);
  // The function already normalises; this is the app's last line of defence before the form.
  const d = (await res.json()) as Record<string, unknown>;
  const amount = typeof d.amount === 'number' && d.amount > 0 ? d.amount : undefined;
  return {
    isSlip: d.isSlip === true && amount !== undefined,
    amount,
    fee: typeof d.fee === 'number' ? d.fee : undefined,
    date: isDate(d.date) ? d.date : undefined,
    time: str(d.time),
    ref: str(d.ref),
    from: party(d.from),
    to: party(d.to),
    memo: str(d.memo),
  };
}
