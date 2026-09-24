# Supabase Edge Functions

| Function | Phase | Contract |
|---|---|---|
| `ai-capture` | 1 | `src/features/ai/types.ts` → `CaptureResponse` |
| `ai-summary` | 2 | SPEC §6.4 |
| `ai-ask` | 3 | SPEC §6.4 |
| `ai-plan` | 3 | SPEC §6.4 |
| `slip-ocr` | 3 | SPEC §6.4 |

กติกา

- เรียก Claude API จากที่นี่เท่านั้น (API key อยู่ใน Supabase secrets ไม่อยู่ในเครื่อง user)
- ทุก response เป็น JSON ตาม type ใน `src/features/ai/types.ts` และ validate ก่อนส่งกลับ
- Log token usage ต่อ user ลงตาราง `ai_usage` สำหรับคิด premium tier
