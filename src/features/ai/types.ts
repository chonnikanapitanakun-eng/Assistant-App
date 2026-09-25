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
 * Contract ของ ai-prep-meeting (SPEC §6.4, P4-05)
 * เปลี่ยนที่นี่ต้องเปลี่ยนที่ supabase/functions/_shared/prep-meeting-contract.ts ด้วย
 */
export type PrepMeetingRequest = {
  locale: 'th' | 'en';
  today: string; // YYYY-MM-DD
  event: { title: string; date: string; startTime?: string | null; endTime?: string | null; location?: string | null; isAllDay?: boolean };
  contact: { name: string; company?: string | null; role?: string | null; notes?: string | null } | null;
  notes: { title: string; body: string }[];
  tasks: { title: string; isDone: boolean; date?: string | null; notes?: string | null }[];
  transactions: { amount: number; currency: string; type: string; note?: string | null; date: string }[];
  /** Earlier events with the same contact. */
  pastEvents: { title: string; date: string }[];
};

export type PrepMeetingResponse = {
  brief: string;
  checklist: string[];
  agenda: string[];
};
