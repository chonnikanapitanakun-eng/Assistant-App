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

- [ ] Today screen
- [x] Tasks: CRUD, checklist, reminder (expo-notifications)
- [x] Timeline drag-drop (กดค้าง ลากย้ายเวลา snap 15 นาที)
- [x] Plan: day / week / month
- [ ] Notes: CRUD, markdown, tags, pin
- [ ] Money: wallets, transactions, categories, สรุปเดือน
- [ ] Contacts + Areas: CRUD, ผูกกับ record
- [x] Links table + UI "เกี่ยวข้องกับ" (docs/LINKS.md)
- [x] Universal search (FTS5 trigram, grouped by type)
- [ ] Quick Capture: text → Supabase Edge Function `ai-capture` → preview → save
- [ ] Voice capture (expo-speech-recognition)

## Phase 2 — เทียบ Tiimo

- [ ] Check-in (mood/energy) + Review screen
- [ ] `ai-summary` daily / weekly + morning briefing notification
- [ ] Focus timer + focus_sessions
- [ ] Routines + energy tag
- [ ] Budget ต่อหมวด + เตือน, recurring bills / subscriptions
- [ ] Net worth (FX rate manual / API)
- [ ] Google Calendar import (read-only)
- [ ] Supabase Auth (Apple/Google) + sync engine
- [ ] PIN / Face ID

## Phase 3 — จุดขายไทย

- [ ] `ai-ask` Q&A ข้ามข้อมูล
- [ ] `ai-plan` จัดวันให้ + approve
- [ ] `ai-breakdown`
- [ ] Slip OCR
- [ ] Export Excel / CSV
- [ ] Home / lock screen widgets
- [ ] Context-aware reminder

## Phase 4 — ปล่อยคนอื่นใช้

- [ ] Gmail: inbox ค้างตอบ, สรุป, draft, follow-up reminder
- [ ] LINE Messaging API → capture
- [ ] ปฏิทินไทย พ.ศ. / วันหยุด / วันพระ
- [ ] Google Calendar 2 ทาง
- [ ] `ai-prep-meeting`
- [ ] Premium tier (RevenueCat)
- [ ] PDPA: privacy policy, export / delete account
- [ ] App Store / Play Store release
