# Roadmap

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
- [ ] Contacts + Areas: CRUD, ผูกกับ record
- [x] Links table + UI "เกี่ยวข้องกับ" (docs/LINKS.md)
- [x] Universal search (FTS5 trigram, grouped by type)
- [x] Quick Capture: text → Supabase Edge Function `ai-capture` → preview → save (Claude structured output + `ai_usage` log; local parser เป็น fallback)
- [ ] Voice capture (expo-speech-recognition)

## Phase 2 — เทียบ Tiimo

- [x] Check-in (mood/energy) + Review screen
- [x] `ai-summary` daily / weekly + morning briefing notification (Review screen `/review`, briefing ตั้งเวลาได้ใน Settings)
- [ ] Focus timer + focus_sessions
- [x] Routines + energy tag (สร้าง task วันนี้อัตโนมัติจาก rule ตอนเปิดแอป, filter ตาม energy)
- [ ] Budget ต่อหมวด + เตือน, recurring bills / subscriptions
- [ ] Net worth (FX rate manual / API)
- [x] Google Calendar import (read-only, หลายบัญชี) — `supabase/functions/gcal`, `src/features/google-calendar`
- [x] Supabase Auth (Google) + sync engine — `src/features/auth`, `src/features/sync`
- [x] Supabase Auth (Apple) — `src/features/auth/apple.ts` (iOS: ระบบ Apple sheet → `signInWithIdToken`; Android/web: Supabase OAuth)
- [x] PIN / Face ID

## Phase 3 — จุดขายไทย

- [ ] `ai-ask` Q&A ข้ามข้อมูล — [x] P3-01 retrieval pipeline + prompt (`src/features/ai/ask`, `supabase/functions/ai-ask`) · [ ] P3-02 UI
- [x] `ai-plan` จัดวันให้ + approve — `supabase/functions/ai-plan`, `src/features/assistant/plan.ts`, การ์ด `apply_plan` (เอาแถวออกได้ก่อนยืนยัน)
- [x] `ai-breakdown` — `supabase/functions/ai-breakdown`, `src/features/ai/breakdown.ts`, `src/features/tasks/components/breakdown-suggestions.tsx`
- [x] Slip OCR — ขั้น 1: slip QR (ฟรี) + `slip-ocr` (Claude Haiku) + จับคู่บัญชี/หมวด — `supabase/functions/slip-ocr`, `src/features/slip`, `src/app/slip.tsx`
- [ ] Slip OCR ขั้น 2: on-device OCR (ML Kit / Apple Vision, dev build) ก่อนเรียก Haiku
- [x] Export Excel / CSV — CSV ต่อเดือน/สกุลเงิน จากแท็บ Money → รายการ (`src/features/money/csv.ts`, `export.ts`)
- [ ] Home / lock screen widgets
- [ ] Context-aware reminder

## Phase 4 — ปล่อยคนอื่นใช้

- [ ] Gmail: inbox ค้างตอบ, สรุป, draft, follow-up reminder
- [ ] LINE Messaging API → capture
- [x] ปฏิทินไทย พ.ศ. / วันหยุด / วันพระ
- [ ] Google Calendar 2 ทาง
- [ ] `ai-prep-meeting`
- [ ] Premium tier (RevenueCat)
- [x] PDPA: privacy policy, export / delete account — `src/app/privacy.tsx`, `src/features/privacy`, `supabase/functions/account`
- [ ] App Store / Play Store release
