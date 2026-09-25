# Proud Assistant — Product Spec

> เลขาส่วนตัวภาษาไทย: จดบันทึก + ตารางงาน + รายรับรายจ่าย + AI
> แรงบันดาลใจจาก Tiimo แต่เพิ่ม Notes, Money และ AI ที่เข้าใจ context ของผู้ใช้

สถานะ: Draft v1 (2026-09-24)
ชื่อ app: ชั่วคราว เปลี่ยนได้ก่อน release

---

## 1. Vision

Planner ธรรมดาช่วย "จำ" แต่เลขาช่วย "คิดและทำ"
App นี้ต้องทำ 3 อย่างให้เหนือกว่า Tiimo

1. **Quick Capture** พิมพ์หรือพูด 1 ประโยค ระบบแยกเป็น task / นัดหมาย / รายจ่าย / contact ให้เอง
2. **Personal Brain** ทุกข้อมูล (งาน นัด โน้ต เงิน คน) ผูกกันได้ และ AI ค้นข้ามได้
3. **Money** ไม่ใช่แค่ expense tracker แต่เป็น Personal Finance OS หลายสกุลเงิน

หลักการ

- **Local-first** ใช้ได้โดยไม่มีเน็ต sync ขึ้น cloud ทีหลัง
- **AI on demand** AI ทำงานเมื่อ user กดเท่านั้น ไม่มี background agent (คุมต้นทุนเมื่อปล่อยคนอื่นใช้)
- **Approve ก่อนทำ** ทุก action ที่ AI เสนอ user ต้องยืนยัน 1 tap
- **i18n ตั้งแต่แรก** ไทย + อังกฤษ

---

## 2. ผู้ใช้

| กลุ่ม | ลักษณะ |
|---|---|
| Primary (Phase 1-3) | เจ้าของ app ใช้เอง: CPA / ที่ปรึกษาภาษี ทำงานไทย + UK รายได้หลายสกุลเงิน เรียน CIMA |
| Secondary (Phase 4) | คนไทยที่ต้องการ planner + บัญชีส่วนตัวในที่เดียว |

---

## 3. Feature ตาม Tiimo (baseline)

| Feature | Tiimo | เรา | Phase |
|---|---|---|---|
| Timeline รายวัน color-coded, drag-drop | ✅ | ✅ | 1 |
| มุมมอง วัน / สัปดาห์ / เดือน | ✅ | ✅ | 1 |
| Routine ประจำ (เช้า/กลางวัน/กลางคืน) | ✅ | ✅ | 2 |
| Checklist ย่อยในงาน | ✅ | ✅ | 1 |
| Reminder | ✅ | ✅ | 1 |
| สี + icon ปรับเอง | 3,000 สี | palette 12 สี + icon set | 1 |
| Brain dump → AI จัดกลุ่ม | ✅ Pro | ✅ (Quick Capture) | 1 |
| AI task breakdown | ✅ Pro | ✅ | 3 |
| AI Co-Planner (จัดวันให้) | ✅ Pro | ✅ | 3 |
| Focus timer | ✅ | ✅ | 2 |
| Focus tunes | ✅ | ❌ ตัด | - |
| Live Activities / Dynamic Island | ✅ | ⏸ | 4+ |
| Mood check-in | ✅ | ✅ | 2 |
| Energy tag ต่องาน | ✅ | ✅ | 2 |
| Daily review | ✅ | ✅ | 2 |
| Weekly review | ❌ | ✅ | 2 |
| Import Google Calendar | ✅ ทางเดียว | ✅ ทางเดียว → 2 ทาง | 2 → 4 |
| Sync Apple Reminders | ✅ | ❌ | - |
| Widgets | ✅ | ✅ | 3 |
| Apple Watch / Mac / Web | ✅ | ⏸ | 4+ |
| Sync หลายเครื่อง | ✅ | ✅ | 2 |
| Dark / light mode | ✅ | ✅ | 1 |
| Free / Pro tier | ✅ | ✅ | 4 |

## 4. Feature ที่ Tiimo ไม่มี (จุดขาย)

| Feature | รายละเอียด | Phase |
|---|---|---|
| **Notes** | markdown, tag, pin, แนบรูป, ค้นหาภาษาไทย | 1 |
| **Money** | บันทึก 2 tap, หลายกระเป๋า (เงินสด/ธนาคาร/บัตร), หลายสกุลเงิน, หมวดหมู่ไทย | 1 |
| **Contacts + Life Areas** | คน/บริษัท และหมวดชีวิต (Work / Personal / Learning / Business) ผูกกับทุก record | 1 |
| **Universal Search** | ค้นคำเดียวเจอทั้ง task / note / transaction / contact / event (SQLite FTS5) | 1 |
| **Links** | ผูก task ↔ contact ↔ transaction ↔ event ↔ note (รากของ Personal Brain) | 1 |
| **Budget + Bills + Subscriptions** | งบรายหมวด เตือนเมื่อใกล้เกิน, bill ประจำเตือนก่อนถึงกำหนด | 2 |
| **Net worth** | รวมทุก wallet แปลงเป็นสกุลหลัก | 2 |
| **AI Summary** | สรุปวัน / สัปดาห์ + morning briefing (นัด + งาน + เงิน) | 2 |
| **AI Q&A** | "เดือนที่แล้วค่าเดินทางเท่าไหร่" "อาทิตย์นี้ต้องตาม partner เรื่องอะไร" | 3 |
| **AI Plan my day** | เอา backlog + calendar + energy มาจัดตาราง user approve ก่อน | 3 |
| **AI Prep meeting** | รวม contact + notes + tasks + email เก่า → checklist + agenda | 4 |
| **Context-aware reminder** | "มีประชุมกับ John 15:00 ยังไม่ได้เตรียม VAT recon เริ่ม Focus ไหม" | 3 |
| **สแกนสลิปโอนเงิน** | อ่านสลิป PromptPay / ธนาคาร → ยอด วันที่ ผู้รับ | 3 |
| **Export Excel / CSV** | รายรับรายจ่าย ต่อยอดทำภาษี | 3 |
| **ปฏิทินไทย** | พ.ศ./ค.ศ., วันหยุดราชการ/ธนาคาร, วันพระ | 4 |
| **LINE bot** | ส่งข้อความเข้า LINE → Quick Capture | 4 |
| **Gmail** | อ่านเมลค้างตอบ, AI สรุป, draft reply, ตั้ง follow-up reminder แบบ manual | 4 |

## 5. ตัดออกอย่างชัดเจน

- WhatsApp / Telegram / Slack / Outlook integration
- "Do it for me" ที่ต้องต่อ booking API (flight, hotel)
- Follow-up agent ที่รัน background ตรวจ email เอง
- Investment auto-sync กับ broker (ทำ manual entry แทน)

---

## 6. Architecture

```
                    QUICK CAPTURE (ทางเข้าเดียว)
                             │
       ┌─────────────────────┼─────────────────────┐
     LIFE                KNOWLEDGE               MONEY
   Calendar               Notes                Wallets
   Tasks                  Contacts             Transactions
   Routines               Life Areas           Bills / Subs
   Check-ins                                   Budget / Net worth
       └─────────────────────┼─────────────────────┘
                     LINKS + UNIVERSAL SEARCH
                             │
                        AI LAYER (on demand)
          Phase 1: parse capture
          Phase 2: summarize daily / weekly, briefing
          Phase 3: Q&A, plan my day, task breakdown
          Phase 4: prep meeting, Gmail, LINE
```

### 6.1 Tech stack

| ส่วน | เลือกใช้ | เหตุผล |
|---|---|---|
| Mobile | Expo (React Native) + TypeScript | iOS/Android ครั้งเดียว |
| Navigation | Expo Router | file-based |
| Local DB | expo-sqlite + Drizzle ORM | offline-first, FTS5 |
| Cloud | Supabase (Auth, Postgres, Storage, Edge Functions) | backup, sync, login Apple/Google |
| State | Zustand + TanStack Query | เบา |
| AI | Claude API ผ่าน Supabase Edge Function | API key ไม่อยู่ในเครื่อง user |
| UI | RN StyleSheet + design tokens (`src/theme`) | เบา ไม่ผูก dependency; ค่อยพิจารณา NativeWind เมื่อ UI โตขึ้น |
| i18n | i18next + react-i18next | ไทย/อังกฤษ |

### 6.2 โครงสร้างโฟลเดอร์

```
assistant-app/
├── app/                      # Expo Router
│   ├── (auth)/               # login, onboarding
│   ├── (tabs)/
│   │   ├── today.tsx         # timeline + งาน + เงินวันนี้
│   │   ├── plan.tsx          # วัน/สัปดาห์/เดือน
│   │   ├── notes.tsx
│   │   ├── money.tsx
│   │   └── review.tsx        # daily/weekly review, mood
│   ├── task/[id].tsx
│   ├── note/[id].tsx
│   ├── transaction/[id].tsx
│   ├── contact/[id].tsx
│   ├── search.tsx
│   └── capture.tsx           # modal
├── src/
│   ├── db/                   # schema, migrations, queries, fts
│   ├── features/
│   │   ├── tasks/
│   │   ├── notes/
│   │   ├── money/
│   │   ├── contacts/
│   │   ├── areas/
│   │   ├── focus/
│   │   ├── review/
│   │   ├── search/
│   │   └── ai/               # capture parser, summary, ask, plan
│   ├── sync/                 # local ↔ Supabase
│   ├── integrations/         # google-calendar, gmail, line
│   ├── components/ui/
│   ├── theme/
│   ├── i18n/                 # th.json, en.json
│   └── lib/                  # thai-date, currency, utils
├── supabase/
│   ├── migrations/
│   └── functions/            # ai-capture, ai-summary, ai-ask, ai-plan, slip-ocr
└── docs/
```

### 6.3 Data model

ทุกตารางมี `id (uuid), user_id, created_at, updated_at, deleted_at, synced_at`

```
areas           name_th, name_en, parent_id, color, icon
                (Work > Accounting/Audit/Tax/Clients, Personal, Learning, Business)

contacts        name, company, role, email, phone, line_id, area_id, notes

tasks           title, notes, date, start_time, end_time, duration_min,
                is_done, done_at, priority (1-3), energy (low/med/high),
                color, icon, area_id, routine_id, checklist (json), reminder_at

routines        title, rule (daily/weekly/custom rrule), period (morning/day/night),
                template (json), area_id

notes           title, body (markdown), tags (json), pinned, attachments (json), area_id

wallets         name, type (cash/bank/card/investment), currency, balance, color

transactions    wallet_id, amount, currency, type (income/expense/transfer),
                to_wallet_id, category_id, area_id, date, note,
                slip_image, source (manual/ai/slip/line)

categories      name_th, name_en, type (income/expense), icon, budget_monthly

recurring_bills name, amount, currency, wallet_id, category_id,
                due_day, frequency (monthly/yearly), remind_days_before, is_subscription

checkins        date, mood (1-5), energy (1-5), reflection

focus_sessions  task_id, started_at, duration_min, completed

calendar_events external_id, source (google), calendar_name, title,
                start, end, location, is_all_day   (read-only)

links           from_type, from_id, to_type, to_id, relation
                (task↔contact, task↔event, transaction↔contact, note↔task, ...)
                relation: with | extracted | related — query pattern + UI: docs/LINKS.md

fts_index       (SQLite FTS5 virtual table) type, id, title, body, tags
```

### 6.4 AI contracts (Edge Functions)

| Function | Input | Output | Phase |
|---|---|---|---|
| `ai-capture` | text, locale, today, contacts[], areas[], wallets[] | `{items: [{type: task\|event\|expense\|income\|note\|contact, fields...}], confidence}` | 1 |
| `ai-summary` | scope (day/week), tasks, events, transactions, checkins | summary_th, highlights[], needs_attention[] | 2 |
| `ai-ask` | question, retrieved_context (จาก FTS + query ไม่ส่งทั้ง DB) | answer, sources[], suggested_actions[] | 3 |
| `ai-plan` | date, backlog, events, energy pattern | schedule[] (user approve ก่อน commit) | 3 |
| `ai-breakdown` | task | subtasks[] | 3 |
| `slip-ocr` | image | amount, date, payee, bank, ref | 3 |
| `ai-prep-meeting` | event, contact, linked notes/tasks/emails | brief, checklist[], agenda[] | 4 |

กติกา AI

- ทุก output เป็น JSON schema ตายตัว validate ก่อนใช้
- ผลลัพธ์ต้องแสดงให้ user ยืนยันก่อนบันทึก
- ส่งเฉพาะข้อมูลที่เกี่ยวข้อง (retrieval ก่อน) ไม่ส่งทั้ง DB
- Log token usage ต่อ user เพื่อคิด premium tier

### 6.5 Sync (Phase 2) — ทำแล้ว ดู docs/SYNC.md

- Local SQLite เป็น source of truth บนเครื่อง
- Push: แถวที่ `updated_at > synced_at` ส่งขึ้น Supabase (ตารางเดียว `sync_rows` เก็บทุก table เป็น jsonb)
- Pull: ดึงแถวที่ `server_seq > cursor` (ลำดับฝั่ง server แทน `last_pull` เพื่อไม่พึ่งนาฬิกาเครื่อง)
- Conflict: last-write-wins ตาม `updated_at` (พอสำหรับ single user หลายเครื่อง)
- Soft delete ผ่าน `deleted_at`

---

## 7. หน้าจอหลัก (Phase 1)

| หน้า | เนื้อหา |
|---|---|
| **Today** | timeline วันนี้ (event + task ตามเวลา), งานไม่มีเวลา, ยอดใช้จ่ายวันนี้ / เดือนนี้, ปุ่ม Capture ลอย |
| **Plan** | สลับ วัน / สัปดาห์ / เดือน, drag-drop, สร้างงานตรงช่องเวลา |
| **Notes** | list + search + tag filter, editor markdown |
| **Money** | สรุปเดือน, list transaction, wallets, เพิ่มเร็ว |
| **Review** | (Phase 2) mood, daily/weekly summary |
| **Capture** | modal: text / voice → AI preview → ยืนยัน |
| **Search** | FTS ข้ามทุก type |

---

## 8. Non-functional

- เปิด app ถึง Today < 1 วินาที (local DB)
- Capture → AI preview < 3 วินาที
- ทำงานได้เต็มโดยไม่มีเน็ต ยกเว้น AI
- PIN / Face ID lock (Phase 2)
- PDPA: privacy policy, export และลบข้อมูลตัวเองได้ (Phase 4)
- Premium tier: free = planner + notes + money manual, pro = AI + sync + slip OCR (Phase 4)
