# Supabase Edge Functions

| Function | Phase | Contract |
|---|---|---|
| `assistant` | 1 | Veyra AI chat — `src/features/assistant/types.ts` (`Proposal`); Claude only *proposes*, the app confirms |
| `ai-capture` | 1 | `src/features/ai/types.ts` → `CaptureResponse` — structured output ตาม `_shared/capture-contract.ts`, prompt ใน `ai-capture/prompt.ts` |
| `ai-summary` | 2 | SPEC §6.4 |
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
- **Model**: `claude-opus-5`, adaptive thinking, effort `low` (งาน extraction สั้น), `max_tokens` 8192 (ใช้ร่วมกับ thinking), server-side fallback เปิดไว้ (`fallbacks: 'default'`) กรณีถูก safety classifier ปฏิเสธ
- **App side** (`src/features/ai/remote.ts`, `use-capture-context.ts`, `src/app/capture.tsx`): แสดงผล parser ในเครื่องทันที แล้วเรียก Claude หลังหยุดพิมพ์ 0.7 วิ; error / offline / `items: []` → ใช้ผลในเครื่องต่อ
- ทดสอบ contract: `npm test` (`src/features/ai/__tests__/capture-contract.test.ts`)

## Setup (ครั้งแรก)

```bash
npx supabase login
npx supabase link --project-ref <ref>
npx supabase db push                       # สร้างตาราง ai_usage
npx supabase secrets set ANTHROPIC_API_KEY=sk-ant-...
npx supabase functions deploy ai-capture assistant
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
