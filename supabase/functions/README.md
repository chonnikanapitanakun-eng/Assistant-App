# Supabase Edge Functions

| Function | Phase | Contract |
|---|---|---|
| `assistant` | 1 | Veyra AI chat — `src/features/assistant/types.ts` (`Proposal`); Claude only *proposes*, the app confirms |
| `gcal` | 2 | Google Calendar import (read-only, หลายบัญชี) — `src/features/google-calendar/types.ts`; ดู § gcal ด้านล่าง |
| `ai-capture` | 1 | `src/features/ai/types.ts` → `CaptureResponse` — structured output ตาม `_shared/capture-contract.ts`, prompt ใน `ai-capture/prompt.ts` |
| `ai-summary` | 2 | SPEC §6.4 |
| `ai-ask` | 3 | SPEC §6.4 |
| `ai-plan` | 3 | SPEC §6.4 |
| `account` | 4 | PDPA: ลบบัญชี (`{ action: 'delete' }` + JWT ผู้ใช้) → ลบ auth user, ตาราง sync / `ai_usage` / `gcal_accounts` cascade ตาม; ดู § account ด้านล่าง |
| `slip-ocr` | 3 | `src/features/slip/types.ts` → `SlipResult` — structured output ตาม `_shared/slip-contract.ts`, prompt ใน `slip-ocr/prompt.ts`; ดู § slip-ocr ด้านล่าง |

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

## Setup (ครั้งแรก)

```bash
npx supabase login
npx supabase link --project-ref <ref>
npx supabase db push                       # สร้างตาราง ai_usage
npx supabase secrets set ANTHROPIC_API_KEY=sk-ant-...
npx supabase functions deploy ai-capture assistant slip-ocr account
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

## slip-ocr — อ่านสลิปโอนเงิน (P3-04)

ออกแบบให้ถูกที่สุด: ขั้นที่ฟรีก่อน เรียก AI เฉพาะที่จำเป็น

1. **แอปย่อรูป** กว้าง 800px, JPEG 0.7 (`src/features/slip/scan.ts`) — ไม่ขยายรูปที่เล็กกว่านั้น
2. **อ่าน QR บนสลิปในเครื่อง (ฟรี)** — `expo-camera` `scanFromURLAsync` → `parseSlipQr` (`src/features/slip/qr.ts`) รองรับ QR ธนาคาร (BOT mini QR เช่น K PLUS) และ QR ของ TrueMoney → ได้เลข ref (K BIZ ไม่มี QR ต้องรอขั้น 3); ถ้า ref นี้บันทึกไปแล้ว (หรือซ้ำในชุดเดียวกัน) → ข้าม **ไม่เรียก AI** (Android อ่าน QR เล็กๆ จากรูปทั้งใบได้ไม่เสมอ, web โหลด zxing wasm จาก CDN — อ่านไม่ได้ก็ไปขั้น 3)
3. **`slip-ocr`** — `claude-haiku-4-5` + structured output (`SLIP_SCHEMA`), ไม่มี thinking, `max_tokens` 1024 → amount / date (แปลง พ.ศ.) / time / ref / ผู้โอน-ผู้รับ (ชื่อ, รหัสธนาคาร, เลขบัญชีที่เห็น) / memo; `normalizeSlip()` ตัดค่าที่ใช้ไม่ได้ก่อนส่งกลับ
   - ต้นทุนโดยประมาณ ~1.5k image tokens + ~0.7k prompt + ~150 output ≈ US$0.003 ต่อใบ (system prompt สั้นกว่าขั้นต่ำที่ cache ได้ของ Haiku จึงไม่ใส่ `cache_control`)
   - refusal / อ่านไม่ออก → `{ isSlip: false }` แอปให้กรอกเอง; ไม่ได้ตั้ง Supabase → แอปข้ามขั้นนี้และให้กรอกเอง
4. **จับคู่ในเครื่อง ไม่เรียก AI** (`src/features/slip/match.ts`)
   - บัญชี: `wallets.bank_code` + `wallets.account_digits` (ตั้งในหน้าแก้บัญชี) — ผู้โอนเป็นบัญชีเรา = รายจ่าย, ผู้รับเป็นบัญชีเรา = รายรับ, ทั้งสองฝั่ง = โอนระหว่างบัญชี
   - หมวด: หมวดที่ผู้รับ/ผู้จ่ายคนนี้ถูกบันทึกบ่อยสุด (`transactions.payee`), ชื่อที่ถูกตัดท้ายต่างกันแต่ละธนาคารก็นับ
5. **หน้า Review** (`src/app/slip.tsx`) — ผู้ใช้แก้/ติ๊กก่อนบันทึก → `source = 'slip'`, `slip_ref` กันบันทึกซ้ำ

ทดสอบ: `npm test` (`src/features/slip/__tests__`) — contract, QR, matching, draft และ `real-slips.test.ts` (โครงสลิปจริง K PLUS จ่ายบิล / TrueMoney / K BIZ — เปลี่ยนชื่อ เลขบัญชี ref แล้ว)

## gcal — Google Calendar import (P2-07)

ต่อได้หลายบัญชี Google ต่อเครื่อง, อ่านอย่างเดียว, ดึงช่วง -30 / +90 วัน, sync ตอนเปิดแอป (ห่างกัน ≥15 นาที) + ปุ่ม "Sync now" ใน Settings

**Flow**

1. แอป `start` → ได้ URL หน้า consent ของ Google (state เซ็นด้วย HMAC, อายุ 10 นาที)
2. Google redirect มาที่ `/gcal/callback` → แลก code เป็น refresh token (เข้ารหัส AES-GCM) → เก็บใน `gcal_pending` ใต้ ticket ใช้ครั้งเดียว → redirect กลับแอป `…/settings?gcal=<ticket>`
3. แอป `finish` ด้วย device key เดียวกัน → ย้ายเข้า `gcal_accounts` (ต้องเป็นเครื่องที่เริ่ม flow เท่านั้น — กันการส่งลิงก์ consent ให้คนอื่นกดแล้วได้ปฏิทินเขาไป)
4. `sync` → refresh access token ทีละบัญชี → ดึง event จากทุกปฏิทินที่ติ๊กไว้ใน Google Calendar (ข้าม cancelled / ที่ตอบ declined) → แอป diff ลง SQLite (`planSync` ใน `src/features/google-calendar/model.ts`) — id ในเครื่องคงเดิมทุกรอบ, นัดที่เชิญทั้ง 2 บัญชีแสดงครั้งเดียว

**Identity**: บัญชียังผูกกับ `sha256(device key)` เสมอ (`src/features/google-calendar/device-key.ts`) — ลบแอป / ล้าง site data ก่อน sign in = ต้องเชื่อมใหม่ เข้าสู่ระบบ (Cloud sync ด้านล่าง) แล้วแอปจะเรียก `claim` ให้อัตโนมัติ ย้าย `user_id` ของบัญชีที่ยังไม่มีเจ้าของให้เครื่องนั้น (idempotent, เรียกซ้ำได้)

**Setup**

1. Google Cloud Console → สร้าง project → **APIs & Services → Library** → เปิด **Google Calendar API**
2. **OAuth consent screen** → External → ใส่ชื่อแอป / email → Scopes: `openid`, `email`, `.../auth/calendar.readonly` → **Test users**: ใส่ทุกอีเมลที่จะเชื่อม
3. **Credentials → Create OAuth client ID** → type **Web application** → Authorized redirect URI:
   `https://<project-ref>.supabase.co/functions/v1/gcal/callback`
4. ตั้ง secrets แล้ว deploy:

```bash
npx supabase db push        # สร้าง gcal_accounts / gcal_pending
npx supabase secrets set \
  GOOGLE_CLIENT_ID=xxx.apps.googleusercontent.com \
  GOOGLE_CLIENT_SECRET=xxx \
  GCAL_TOKEN_KEY=$(openssl rand -base64 32) \
  GCAL_RETURN_PREFIXES="veyra://,https://<your-site>.netlify.app/settings"
npx supabase functions deploy gcal
```

- `GCAL_RETURN_PREFIXES` = URL ที่อนุญาตให้ redirect กลับ (กัน open redirect) — ใส่ `veyra://` (แอปจริง / dev build), URL เว็บ `…/settings`, และตอน dev ใส่ `exp://` (Expo Go) หรือ `http://localhost:8081/settings`
- `GCAL_TOKEN_KEY` ห้ามเปลี่ยนหลังใช้งานแล้ว — token เดิมจะถอดรหัสไม่ได้ (ต้องเชื่อมใหม่ทุกบัญชี)

**ข้อจำกัดโหมด Testing ของ Google**: ผู้ใช้ทดสอบไม่เกิน 100 คน และ refresh token หมดอายุทุก 7 วัน → บัญชีขึ้น "ต้องเชื่อมใหม่" ใน Settings กดปุ่มเดียวจบ (ต้องผ่าน Google verification ก่อนปล่อยคนอื่นใช้ — Phase 4)

## Cloud sync (P2) — Supabase Auth + sync tables

เข้าสู่ระบบด้วย Google (`src/features/auth`) แล้วทุกตารางที่มี base columns สำหรับ sync (`src/db/schema.ts`) จะ push/pull ข้อมูลไปมากับ Postgres โดยตรงผ่าน Supabase client ของแอป (ไม่ผ่าน Edge Function — RLS คุมสิทธิ์แทน) ดู `src/features/sync` (push/pull ทีละแถวที่เปลี่ยน, last-write-wins ด้วย `updatedAt`) — ยังไม่มี Apple Sign In

**ตาราง**: areas, contacts, routines, tasks, notes, wallets, categories, transactions, recurring_bills, checkins, focus_sessions, assistant_messages, links (`supabase/migrations/20260925010000_sync_tables.sql`) — `calendar_events`/`calendar_accounts` ไม่รวม เพราะซิงก์ผ่าน `gcal` อยู่แล้ว

**Setup (ครั้งแรก)**

1. Supabase Dashboard → **Authentication → Providers → Google** → ใส่ Client ID / Client Secret **ตัวเดียวกับ `GOOGLE_CLIENT_ID` / `GOOGLE_CLIENT_SECRET` ของ `gcal`** — ตอน sign in แอปขอสิทธิ์ `calendar.readonly` ในหน้า consent เดียวกัน แล้วส่ง refresh token ที่ได้ไปให้ `gcal` (action `link`) ผูกปฏิทินของ email นั้นให้ทันที (ข้ามถ้าเครื่องนี้ผูก email นั้นไว้แล้ว) — ถ้าใช้ client คนละตัว Google จะปฏิเสธ token (`client_mismatch`) ต้องไปกด "เพิ่มบัญชี" ใน Settings เอง ส่วน email อื่นๆ เพิ่มที่ Settings → Google Calendar เหมือนเดิม
   - ใน Google Cloud Console เพิ่ม Authorized redirect URI ของ Supabase Auth ด้วย: `https://<project-ref>.supabase.co/auth/v1/callback`
2. **Authentication → URL Configuration → Redirect URLs** → เพิ่ม `veyra://settings`, `http://localhost:8081/settings` (dev), และ URL เว็บ `…/settings`
3. Push ตาราง sync:

```bash
npx supabase db push        # สร้างตาราง areas/tasks/notes/... + RLS
```

- `ai-capture` / `assistant` เปลี่ยนเป็น `verify_jwt = true` แล้ว (`supabase/config.toml`) — คนที่ยังไม่ login ก็ยังเรียกได้ปกติ (anon key เองก็เป็น JWT ที่ผ่านการตรวจสอบ), login แล้ว `ai_usage.user_id` จะเป็นของจริง
- ลบแอป / ล้าง site data แล้วเข้าสู่ระบบใหม่ (บัญชี Google เดิม) = ข้อมูลกลับมาครบจาก Postgres

## account — PDPA (P4-07): export / ลบบัญชี

- **Export** ไม่ต้องผ่านฟังก์ชัน: เครื่องมีข้อมูลครบกว่า cloud (calendar events / accounts ไม่ซิงก์) แอปจึงอ่านจาก SQLite ทุกตารางแล้วสร้าง JSON เอง (`src/features/privacy/export.ts` — web ดาวน์โหลด, มือถือเปิด share sheet) ตัดคอลัมน์ที่เป็น bookkeeping ของเครื่อง (`syncedAt`, `userId`, `reminderNotificationId`)
- **ลบข้อมูลในเครื่อง** (`erase.ts`): sign out → ลบทุกแถวทุกตาราง + kv-store (profile, device key, sync cursors) + ยกเลิก notification → seed ค่าเริ่มต้นใหม่ → กลับไป onboarding; cloud ไม่ถูกแตะ
- **ลบบัญชี** (`account.ts` → ฟังก์ชันนี้): `POST { action: 'delete' }` พร้อม JWT ของผู้ใช้ → เพิกถอน Google refresh token ทุกบัญชีที่ผูก (best effort — ต้องมี `GCAL_TOKEN_KEY` ตัวเดียวกับ `gcal` ถึงถอดรหัสได้) แล้ว `auth.admin.deleteUser` → ทุกตาราง sync, `ai_usage`, `gcal_accounts` หายตาม FK `on delete cascade` → แอปลบข้อมูลในเครื่องต่อ (sign out แบบ local เพราะ session ฝั่ง server ไม่มีแล้ว)
- **นโยบายความเป็นส่วนตัว**: `src/app/privacy.tsx` ข้อความสองภาษาใน `src/i18n/*.json` (`privacy.sections`) — บนเว็บ URL `…/privacy` ใช้เป็นลิงก์นโยบายสำหรับ App Store / Play Store ได้; อีเมลติดต่อและวันที่อัปเดตอยู่ใน `src/features/privacy/policy.ts`

```bash
npx supabase functions deploy account
```
