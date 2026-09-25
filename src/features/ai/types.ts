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
 * Contract ของ ai-ask (SPEC §6.4, P3-01) — mirror ของ supabase/functions/_shared/ask-contract.ts
 * แอปทำ retrieval เอง (src/features/ai/ask/) แล้วส่งเฉพาะ record ที่เกี่ยวข้อง แต่ละอันมี ref สั้นๆ (T1, E2, N3, X4, C5, B6)
 * Claude อ้าง ref กลับมาเป็น sources; แอป map กลับเป็น record จริง
 */
export type AskRecordType = 'task' | 'event' | 'note' | 'transaction' | 'contact' | 'bill';
export type AskRecord = { ref: string; type: AskRecordType; text: string };

export type AskSuggestedAction = { label: string; type: 'task' | 'event' | 'note'; title: string; date?: string; startTime?: string };

export type AskResponse = {
  answer: string;
  sources: { ref: string }[];
  suggestedActions: AskSuggestedAction[];
  followUps: string[];
  /** Set by the function when it could not answer (refusal / unparseable output); `answer` is then empty. */
  status?: 'refusal' | 'invalid';
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
