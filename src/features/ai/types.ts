/**
 * Contract ของ ai-capture (SPEC §6.4)
 * ใช้ร่วมกันระหว่าง app กับ Edge Function — เปลี่ยนที่นี่ต้องเปลี่ยนที่ supabase/functions/ai-capture ด้วย
 */
export type CaptureTask = {
  type: 'task';
  title: string;
  date?: string; // YYYY-MM-DD
  startTime?: string; // HH:mm
  endTime?: string;
  contactName?: string;
};

export type CaptureMoney = {
  type: 'expense' | 'income';
  amount: number;
  currency: string;
  note?: string;
  categoryHint?: string;
  date?: string;
};

export type CaptureNote = {
  type: 'note';
  body: string;
};

export type CaptureItem = CaptureTask | CaptureMoney | CaptureNote;

export type CaptureResponse = {
  items: CaptureItem[];
  confidence: number; // 0-1
};
