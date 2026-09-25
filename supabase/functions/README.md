# Supabase Edge Functions

| Function | Phase | Contract |
|---|---|---|
| `assistant` | 1 | Veyra AI chat — `src/features/assistant/types.ts` (`Proposal`); Claude only *proposes*, the app confirms |
| `ai-capture` | 1 | `src/features/ai/types.ts` → `CaptureResponse` — structured output ตาม `_shared/capture-contract.ts`, prompt ใน `ai-capture/prompt.ts` |
| `ai-summary` | 2 | `src/features/ai/summary.ts` → `SummaryResponse` — structured output ตาม `_shared/summary-contract.ts`, prompt ใน `ai-summary/prompt.ts` |
| `ai-ask` | 3 | SPEC §6.4 |
| `ai-plan` | 3 | SPEC §6.4 |
| `slip-ocr` | 3 | SPEC §6.4 |

กติกา

- เรียก Claude API จากที่นี่เท่านั้น (API key อยู่ใน Supabase secrets ไม่อยู่ในเครื่อง user)
- ทุก response เป็น JSON ตาม type ใน `src/features/ai/types.ts` และ validate ก่อนส่งกลับ
- Log token usage ต่อ user ลงตาราง `ai_usage` (`supabase/migrations/20260924000000_ai_usage.sql`) สำหรับคิด premium tier — เขียนด้วย service role, user อ่านได้เฉพาะของตัวเอง (RLS); Phase 1 ยังไม่มี login ค่า `user_id` จึงเป็น null

## ai-capture — prompt design

- **System prompt** (`ai-capture/prompt.ts`) คงที่ + `cache_control` → ส่วนที่เปลี่ยนต่อ request (วันนี้+วันในสัปดาห์, locale, สกุลเงิน default, ชื่อ contacts / areas / wallets / categories, ข้อความ) อยู่ใน user turn
- **Structured output**: `output_config.format = json_schema` (`_shared/capture-contract.ts`) ทุก field เป็น `required` และ optional ใช้ `null` เพื่อให้ schema strict; `normalizeCaptureResponse()` ตัด null / item ที่ใช้ไม่ได้ / เติม contact ให้คนที่ถูกเอ่ยชื่อ ก่อนส่งกลับ
- **กติกาในการ prompt**: แยกหลาย item จากประโยคเดียว, วัน-เวลาสัมพัทธ์ไทย/อังกฤษ (บ่าย 2, 2 ทุ่ม, มะรืน, next Mon, พ.ศ.), เงิน (£/ปอนด์/k/ตัวเลขที่ไม่ใช่เงิน), เก็บชื่อคนตามที่พิมพ์ (คุณ/พี่), note เป็น fallback เท่านั้น, confidence 0–1
- **Model**: `claude-opus-5`, adaptive thinking, effort `low` (งาน extraction สั้น), `max_tokens` 2048, server-side fallback เปิดไว้ (`fallbacks: 'default'`) กรณีถูก safety classifier ปฏิเสธ
- **App side** (`src/features/ai/remote.ts`, `use-capture-context.ts`, `src/app/capture.tsx`): แสดงผล parser ในเครื่องทันที แล้วเรียก Claude หลังหยุดพิมพ์ 0.7 วิ; error / offline / `items: []` → ใช้ผลในเครื่องต่อ
- ทดสอบ contract: `npm test` (`src/features/ai/__tests__/capture-contract.test.ts`)

## ai-summary — prompt design

- **Input**: app ทำ retrieval ก่อน (`src/features/review/model.ts` → `buildSummaryRequest`) ส่งเฉพาะแถวในช่วง: งานของวัน/สัปดาห์ + งานเลยกำหนด + งานที่เสร็จในช่วง, นัดในช่วง, บิลที่ถึงกำหนด/ใกล้ถึง, ยอดรับ-จ่ายในช่วง + หมวดที่เกินงบเดือน, check-in (mood/energy) — ไม่ส่งทั้ง DB
- **System prompt** (`ai-summary/prompt.ts`) คงที่ + `cache_control`; ส่วนที่เปลี่ยน (scope, range, วันนี้, locale, ชื่อ, แถวข้อมูลแบบบรรทัดละรายการ) อยู่ใน user turn
- **Structured output**: `{ headline, summary, highlights[], needs_attention[] }` (`_shared/summary-contract.ts`); `normalizeSummaryResponse()` ตัดช่องว่าง จำกัด 5 รายการ/ลิสต์ และ headline ≤ 90 ตัวอักษร; response กลับเป็น `{ summary: SummaryResponse | null, status }` — `null` = app ใช้สรุปแบบ rule-based (`localSummary`)
- **กติกาในการ prompt**: ตอบภาษาตาม locale, ใช้เฉพาะแถวที่ให้ ห้ามแต่งเพิ่ม, needs_attention เรียง เลยกำหนด → บิล → งานสำคัญ → เกินงบ, ไม่ซ้ำกันสองลิสต์, headline สั้นพอสำหรับ notification
- **Model**: `claude-opus-5`, adaptive thinking, effort `low`, `max_tokens` 2048, server-side fallback เปิดไว้
- **App side** (`src/features/review/use-summary.ts`, `src/app/review.tsx`): แสดง `localSummary` ทันที แล้วเรียก Claude ผ่าน react-query; cache ผลต่อ (scope, วันเริ่มช่วง) ใน kv-store — ใช้ซ้ำถ้าข้อมูลไม่เปลี่ยน หรือยังไม่เกิน 30 นาที; ปุ่ม refresh บังคับเรียกใหม่
- **Morning briefing** (`src/features/notifications/briefing.ts`): local notification ล่วงหน้า 7 เช้า (เนื้อหาจากข้อมูลในเครื่อง: นัด/งาน/บิลของวันนั้น + นัดแรก หรือจำนวนงานเลยกำหนด) rebuild ทุกครั้งที่ข้อมูลหรือเวลาที่ตั้งเปลี่ยน; แตะแล้วเปิด `/review`; เปิด/ปิดและตั้งเวลาใน Settings (`profile.briefing`)
- ทดสอบ: `npm test` (`src/features/review/__tests__/`, `src/features/notifications/__tests__/briefing.test.ts`)

## Setup (ครั้งแรก)

```bash
npx supabase login
npx supabase link --project-ref <ref>
npx supabase db push                       # สร้างตาราง ai_usage
npx supabase secrets set ANTHROPIC_API_KEY=sk-ant-...
npx supabase functions deploy ai-capture ai-summary assistant
```

ทดสอบเรียกตรง:

```bash
curl -X POST "$SUPABASE_URL/functions/v1/ai-capture" \
  -H "Authorization: Bearer $SUPABASE_ANON_KEY" -H "apikey: $SUPABASE_ANON_KEY" -H "content-type: application/json" \
  -d '{"text":"Meeting with John tomorrow at 10 about VAT £5,000","locale":"en","today":"2026-09-24","weekday":"Thursday","defaultCurrency":"THB","contacts":["John Smith"],"categories":{"expense":["Tax"],"income":["Audit fee"]}}'
```

เปิดใช้ Veyra AI (Claude)

1. `supabase secrets set ANTHROPIC_API_KEY=...`
2. `supabase functions deploy assistant`
3. ใส่ `EXPO_PUBLIC_SUPABASE_URL` และ `EXPO_PUBLIC_SUPABASE_ANON_KEY` ใน `.env` แล้ว restart Expo — ถ้าไม่ตั้ง แอปตอบด้วย engine ในเครื่อง (`src/features/assistant/engine.ts`)
