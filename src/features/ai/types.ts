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
  contactName?: string;
};

export type CaptureNote = {
  type: 'note';
  body: string;
};

export type CaptureEvent = {
  type: 'event';
  title: string;
  date: string; // YYYY-MM-DD
  startTime?: string; // HH:mm — absent = all-day
  endTime?: string;
  contactName?: string;
};

export type CaptureContact = {
  type: 'contact';
  name: string;
};

export type CaptureItem = CaptureTask | CaptureEvent | CaptureMoney | CaptureNote | CaptureContact;
export type CaptureType = CaptureItem['type'];

export type CaptureResponse = {
  items: CaptureItem[];
  confidence: number; // 0-1
};

/**
 * Contract ของ ai-breakdown (SPEC §6.4)
 * ใช้ร่วมกันระหว่าง app กับ Edge Function — เปลี่ยนที่นี่ต้องเปลี่ยนที่ supabase/functions/ai-breakdown ด้วย
 */
export type BreakdownSubtask = {
  text: string;
};

export type BreakdownResponse = {
  subtasks: BreakdownSubtask[];
};
