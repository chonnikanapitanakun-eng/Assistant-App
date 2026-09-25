/**
 * Contract ของ slip-ocr (SPEC §6.4) — mirror ของ supabase/functions/_shared/slip-contract.ts
 * เปลี่ยนที่นี่ต้องเปลี่ยนที่ Edge Function ด้วย
 */
export type SlipParty = { name?: string; bankCode?: string; accountDigits?: string };

export type SlipResult = {
  isSlip: boolean;
  amount?: number;
  fee?: number;
  date?: string; // YYYY-MM-DD
  time?: string; // HH:mm
  ref?: string;
  from: SlipParty;
  to: SlipParty;
  memo?: string;
};
