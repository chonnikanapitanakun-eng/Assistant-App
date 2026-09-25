# Google OAuth verification — แผน 2 เฟส

Gmail scopes เป็น **restricted** ถ้าจะเปิดให้คนทั่วไปใช้ ต้องผ่าน CASA security assessment ซึ่งมีค่าใช้จ่ายและต้องประเมินซ้ำทุกปี ส่วน Calendar เป็นแค่ **sensitive** ต้อง verify แต่ไม่ต้องทำ CASA จึงแยกเป็น 2 Google Cloud project

| | Project A — แอปหลัก | Project B — Gmail (ใช้เอง) |
|---|---|---|
| ใช้กับ | Supabase Auth (sign-in) + `gcal` | `gmail` |
| Secrets | `GOOGLE_CLIENT_ID` / `GOOGLE_CLIENT_SECRET` | `GMAIL_CLIENT_ID` / `GMAIL_CLIENT_SECRET` |
| Scopes | `openid`, `email`, `calendar.readonly` | `openid`, `email`, `gmail.readonly`, `gmail.compose` |
| Publishing status | **In production** (หลัง verify เฟส A) | **Testing** — test users ไม่เกิน 100 คน |
| ค่าใช้จ่าย | ฟรี | ฟรี (จนกว่าจะเปิดให้ทุกคน) |
| ข้อจำกัด | — | refresh token หมดอายุทุก 7 วัน ต้องกดเชื่อมใหม่, เห็นหน้าเตือน "unverified app" |

แอปซ่อนเมนู Inbox ถ้าไม่ได้ตั้ง `EXPO_PUBLIC_GMAIL=1` build สาธารณะจึงไม่เห็น Gmail เลย

> ⚠️ กติกาของ Google ในเอกสารนี้อ้างอิงจากความรู้ ณ ตอนเขียน ยังไม่ได้เทียบกับเอกสารล่าสุด ก่อนยื่นให้เช็คหน้า *OAuth app verification* และ *Restricted scope verification* ของ Google อีกครั้ง

---

## เฟส A — verify แอปหลัก (sign-in + Calendar)

**Branding** (Google Auth Platform → Branding)
- [ ] App name "Veyra", logo, support email
- [ ] Homepage URL บนโดเมนที่เป็นเจ้าของ (verify ใน Search Console)
- [ ] Privacy policy URL และ Terms of service URL บนโดเมนเดียวกัน
- [ ] Authorized domains: โดเมน homepage + `supabase.co`

**Data access**
- [ ] มีแค่ `openid`, `email`, `calendar.readonly` — **ห้ามมี Gmail scope ใน project นี้**
- [ ] Justification ของ `calendar.readonly`:
  > Veyra shows the user's Google Calendar events alongside their tasks in a single day view. Read-only; events are edited in Google Calendar.

**Demo video** (YouTube unlisted, ภาษาอังกฤษ ~2 นาที)
1. หน้า sign-in → แสดง URL consent ของ Google ให้เห็น `client_id`
2. หน้า consent: app name + scopes → Allow
3. หน้า Calendar ของแอปแสดงนัดจาก Google
4. Settings → Remove บัญชี → แสดงว่าสิทธิ์ถูกถอนใน myaccount.google.com/permissions

**Privacy policy** ต้องมีประโยคนี้ตามตัวอักษร:
> Veyra's use and transfer to any other app of information received from Google APIs will adhere to the [Google API Services User Data Policy](https://developers.google.com/terms/api-services-user-data-policy), including the Limited Use requirements.

- [ ] เปลี่ยน Publishing status เป็น In production แล้วกด Submit for verification

## Project B — Gmail ใช้เอง (ทำได้เลย ไม่ต้องรอเฟส A)

ขั้นตอนตั้งค่าอยู่ใน `supabase/functions/README.md` § gmail สรุปสั้นๆ:
- [ ] สร้าง project ใหม่ → เปิด Gmail API → consent screen แบบ **Testing** → ใส่อีเมลตัวเองใน Test users
- [ ] OAuth client (Web) → redirect URI `…/functions/v1/gmail/callback`
- [ ] ตั้ง secrets `GMAIL_*` → `supabase db push` → deploy `gmail`
- [ ] ใส่ `EXPO_PUBLIC_GMAIL=1` ใน build ที่ใช้เอง

**อย่าเปลี่ยน Project B เป็น In production** ถ้ายังไม่ได้ยื่น verify เพราะแอปจะถูกจำกัดและขึ้นคำเตือนกับทุกคน

---

## เฟส B — (อนาคต) เปิด Gmail ให้ทุกคน

ทำเมื่อคุ้มค่า CASA แล้ว โค้ดไม่ต้องเขียนใหม่

1. ยื่น verify Project B (หรือย้าย Gmail scopes ไป Project A แล้วยื่นเพิ่ม)
2. ทำ CASA กับ lab ที่ Google รับรอง (ขอใบเสนอราคาล่าสุด) ประเมินซ้ำทุก 12 เดือน
3. เอา `EXPO_PUBLIC_GMAIL=1` ใส่ build สาธารณะ

**Scope justification**

| Scope | ใช้ทำอะไร | ทำไมใช้ scope ที่แคบกว่าไม่ได้ |
|---|---|---|
| `gmail.readonly` | หาอีเมลที่ยังไม่ได้ตอบ + อ่าน thread ที่ผู้ใช้เปิด เพื่อสรุปและร่างคำตอบ | `gmail.metadata` ไม่มีเนื้อหาเมล |
| `gmail.compose` | บันทึกคำตอบเป็น draft ใน thread เดิม ไม่ส่งเมลเอง | ไม่มี scope ที่สร้าง draft ได้อย่างเดียว |

> **gmail.readonly** — Veyra's Inbox screen lists the user's own recent inbox threads that are still waiting on their reply. When the user opens a thread, Veyra reads its content to show a short summary and a suggested reply. Content is fetched on demand, shown only to the user, and never stored on our servers. gmail.metadata is not sufficient because the summary and reply need the message body.
>
> **gmail.compose** — After the user reviews and edits the suggested reply, Veyra saves it as a draft reply in the same thread (users.drafts.create). Veyra never sends email; the user sends the draft from Gmail.

**Privacy policy เพิ่มเติมสำหรับ Gmail**
- อ่านอะไร: หัวเรื่อง, ผู้ส่ง, snippet และเนื้อหาของ thread ที่ผู้ใช้เปิด
- ไม่เก็บเนื้อหาอีเมลบน server, ไม่ใช้เพื่อโฆษณา, ไม่ขายต่อ, คนไม่ได้อ่าน
- เนื้อหา thread ที่ผู้ใช้เปิดจะส่งไป Anthropic (Claude API) เพื่อสรุป/ร่างคำตอบ และไม่นำไปใช้ train โมเดลทั่วไป (ยืนยันกับ commercial terms ปัจจุบันของ Anthropic ก่อนเผยแพร่)

**Demo video เพิ่มเติม**: More → Inbox → เปิด thread → AI summary → แก้คำตอบ → Save as Gmail draft → เปิด Gmail Drafts ให้เห็นว่ายังไม่ถูกส่ง → Remove บัญชี

**ที่โค้ดรองรับไว้แล้ว (ตอบ CASA)**
- Refresh token เข้ารหัส AES-GCM (`_shared/google.ts`), ตาราง RLS เปิดแบบไม่มี policy (อ่านได้เฉพาะ service role)
- ไม่มีตารางเก็บเมล, log เฉพาะ error message ไม่มีเนื้อหา (`gmail/index.ts`)
- Draft เท่านั้น ไม่มีโค้ดส่งเมล
- Remove = revoke token ที่ Google + ลบแถว (`gmail` `disconnect`)
- ก่อนเฟส B ต้องมี PDPA: export / ลบบัญชี (ลบบัญชีต้อง revoke + ลบแถว `gmail_accounts`)
