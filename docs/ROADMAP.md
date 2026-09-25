# Roadmap

สถานะ (2026-09-25): Phase 0-2 เสร็จเกือบทั้งหมด, Phase 3 เหลือ ai-ask UI กับ on-device OCR ขั้น 2, Phase 4 core ของฝั่งไทย (ปฏิทินไทย, prep-meeting, PDPA) เสร็จแล้วแต่ Gmail/LINE/Premium/store release ยังไม่ทำหรือยังไม่ merge เข้า branch นี้

| Phase | เป้าหมาย | ผลลัพธ์ |
|---|---|---|
| 0 | Foundation | app เปิดได้ มี DB, theme, i18n, navigation |
| 1 | MVP ใช้เองทุกวัน | Today, Tasks, Notes, Money, Contacts/Areas, Search, Quick Capture AI |
| 2 | เทียบ Tiimo | Review + mood/energy, Focus timer, Routines, Budget/Bills, Google Calendar import, Cloud sync, PIN lock |
| 3 | จุดขายไทย | AI Q&A, Plan my day, Task breakdown, Slip OCR, Export Excel, Widgets, Context reminder |
| 4 | ปล่อยคนอื่นใช้ | Gmail, LINE bot, ปฏิทินไทย, Calendar 2 ทาง, Prep meeting, Premium tier, PDPA, Store release |

## Phase 0 — Foundation

- [x] Expo + TypeScript + Expo Router
- [x] Theme tokens (Navy/Silver, dark/light)
- [x] i18n (th/en) โครง
- [x] expo-sqlite + Drizzle schema ทุกตาราง + migrations
- [x] FTS5 virtual table + trigger
- [x] Tab navigation 4 tab (Today / Plan / Notes / Money) + Capture button
- [x] Seed: areas, categories ภาษาไทย, wallet เริ่มต้น
- [x] Lint / typecheck / test script
- [x] Quick Capture แบบ rule-based (offline fallback) + preview + save
- [ ] ทดสอบบนเครื่องจริง (development build)

## Phase 1 — MVP

- [x] Today screen
- [x] Tasks: CRUD, checklist, reminder (expo-notifications)
- [x] Timeline drag-drop (กดค้าง ลากย้ายเวลา snap 15 นาที)
- [x] Plan: day / week / month
- [x] Notes: CRUD, markdown, tags, pin
- [x] Money: wallets, transactions, categories, สรุปเดือน
- [ ] Contacts + Areas: CRUD, ผูกกับ record — มีแค่ data model + auto-create จาก ai-capture/links (`src/features/contacts/links.ts`, `src/db/seed.ts`); ยังไม่มีหน้าจอ list/edit/delete (เมนู "เพิ่มเติม" ทำเครื่องหมาย contacts ว่า "เร็วๆ นี้" ใน `src/app/more.tsx`) และไม่มีหน้าจัดการ areas เลย
- [x] Links table + UI "เกี่ยวข้องกับ" (docs/LINKS.md)
- [x] Universal search (FTS5 trigram, grouped by type)
- [x] Quick Capture: text → Supabase Edge Function `ai-capture` → preview → save (Claude structured output + `ai_usage` log; local parser เป็น fallback)
- [x] Voice capture ไทย/อังกฤษ (expo-speech-recognition, ต้องใช้ development build — Expo Go ไม่มี native module; เว็บใช้ Web Speech API)

## Phase 2 — เทียบ Tiimo

- [x] Check-in (mood/energy) + Review screen
- [x] `ai-summary` daily / weekly + morning briefing notification (Review screen `/review`, briefing ตั้งเวลาได้ใน Settings)
- [x] Focus timer + focus_sessions — `src/features/focus` (timer, insights, week chart), หน้า `/focus`, ตาราง `focus_sessions` ใน `src/db/schema.ts`
- [x] Routines + energy tag (สร้าง task วันนี้อัตโนมัติจาก rule ตอนเปิดแอป, filter ตาม energy)
- [x] Budget ต่อหมวด + เตือน, recurring bills / subscriptions — `src/features/money/components/budget-bar.tsx`, หน้า `/budget/[id]` และ `/bill/[id]`, ตาราง `recurring_bills` (`is_subscription`), เตือนบิลใน `src/features/notifications/bills.ts`
- [x] Net worth (FX rate manual / API) — `netWorth()` + `toPrimary()` ใน `src/features/money/model.ts`
- [x] Google Calendar import (read-only, หลายบัญชี) — `supabase/functions/gcal`, `src/features/google-calendar`
- [x] Supabase Auth (Google) + sync engine — `src/features/auth`, `src/features/sync`
- [x] Supabase Auth (Apple) — `src/features/auth/apple.ts` (iOS: ระบบ Apple sheet → `signInWithIdToken`; Android/web: Supabase OAuth)
- [x] PIN / Face ID — รวม Forgot-PIN erase device (`src/features/security/forgot-pin.ts`)

## Phase 3 — จุดขายไทย

- [ ] `ai-ask` Q&A ข้ามข้อมูล — [x] P3-01 retrieval pipeline + prompt (`src/features/ai/ask`, `supabase/functions/ai-ask`) · [ ] P3-02 UI (ยังไม่มีหน้าจอ ดู "Open decisions")
- [x] `ai-plan` จัดวันให้ + approve — `supabase/functions/ai-plan`, `src/features/assistant/plan.ts`, การ์ด `apply_plan` (เอาแถวออกได้ก่อนยืนยัน)
- [x] `ai-breakdown` — `supabase/functions/ai-breakdown`, `src/features/ai/breakdown.ts`, `src/features/tasks/components/breakdown-suggestions.tsx`
- [x] Slip OCR — ขั้น 1: slip QR (ฟรี) + `slip-ocr` (Claude Haiku) + จับคู่บัญชี/หมวด — `supabase/functions/slip-ocr`, `src/features/slip`, `src/app/slip.tsx`
- [ ] Slip OCR ขั้น 2: on-device OCR (ML Kit / Apple Vision, dev build) ก่อนเรียก Haiku
- [x] Export CSV — CSV ต่อเดือน/สกุลเงิน จากแท็บ Money → รายการ (`src/features/money/csv.ts`, `export.ts`); ยัง**ไม่มี** Export Excel (.xlsx) — มีแค่ CSV
- [x] Home / lock screen widgets — `src/features/widgets` (iOS: expo-widgets home + lock screen; Android: react-native-android-widget home screen; ต้องใช้ development build)
- [x] Context-aware reminder — `src/features/context-reminders` (rule-based offline: ก่อนนัด X นาที เตือนงานที่ยังไม่เสร็จซึ่งผูกกับนัด/คนในนัด → แตะเปิด Focus; ตั้งเวลาใน Settings)

## Phase 4 — ปล่อยคนอื่นใช้

- [ ] Gmail: inbox ค้างตอบ, สรุป, draft, follow-up reminder (พร้อมแล้วบน branch `claude/dazzling-ride-2qm6sz`, ยังไม่ merge โดยตั้งใจ)
- [ ] LINE Messaging API → capture
- [x] ปฏิทินไทย พ.ศ. / วันหยุด / วันพระ — `src/lib/thai-holidays.ts`, `src/lib/thai-lunar.ts`, `src/lib/date.ts`
- [ ] Google Calendar 2 ทาง
- [x] `ai-prep-meeting` — `supabase/functions/ai-prep-meeting`, `src/features/ai/prep-meeting.ts`, ปุ่ม "เตรียมนัดนี้" ในหน้า event
- [ ] Premium tier (RevenueCat) (พร้อมแล้วบน branch `claude/awesome-euler-61w29g`, ยังไม่ merge โดยตั้งใจ)
- [x] PDPA: privacy policy, export / delete account — `src/app/privacy.tsx`, `src/features/privacy`, `supabase/functions/account`
- [ ] App Store / Play Store release

## Open decisions

รอเจ้าของโปรเจกต์ตัดสินใจ:

- `ai-ask` ยังไม่มีหน้าจอ — จะให้ผู้ใช้ถามผ่าน Veyra chat แล้ว route เข้า `ai-ask` หรือจะสร้างหน้า Q&A แยกต่างหาก
- Export CSV ยังไม่มีคอลัมน์ payee (ผู้รับ/ผู้จ่าย)
- Widget (home/lock screen) ยังโชว์ข้อมูล task/bill อยู่แม้ตอนเปิด PIN lock ไว้
- Android widget ใช้ third-party `react-native-android-widget` — จะเปลี่ยนไปใช้ `enableAndroid` ของ `expo-widgets` แทนหรือไม่
- i18n key `capture.media_voice` / `capture.media_photo` ไม่ได้ใช้งานแล้วในโค้ด (ค้างจากตอน voice/photo capture ยังไม่เสร็จ)
- หน้าตั้งค่า PIN ควรเตือนผู้ใช้ว่า Forgot PIN จะลบข้อมูลทั้งเครื่อง (erase) หรือยัง
- sync engine ยังไม่ merge ค่า default areas/categories/wallets ข้ามเครื่อง, ยังไม่ล้างข้อมูล local ตอนเปลี่ยนผู้ใช้ในเครื่องเดียวกัน, และยังไม่ตัด `reminder_notification_id` ออกจากการ sync
