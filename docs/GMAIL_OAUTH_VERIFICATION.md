# Google OAuth verification — Gmail (P4-01)

ต้องทำก่อนปล่อยให้คนอื่นนอกจาก test users ใช้ Veyra กับ Gmail ขั้นตอนนี้ทำในโค้ดไม่ได้ เจ้าของโปรเจกต์ต้องยื่นเองใน Google Cloud Console

> **ใช้เองคนเดียว / ทีมเล็ก**: ยังไม่ต้องยื่น ให้เปิด consent screen ในโหมด **Testing** แล้วใส่อีเมลใน Test users (ได้ไม่เกิน 100 คน) ข้อจำกัดคือ refresh token หมดอายุทุก 7 วัน (แอปจะขึ้น "เชื่อมใหม่") และจะเห็นหน้าเตือน "Google hasn't verified this app"

## 1. Scopes ที่แอปขอ

| Scope | ระดับ | ใช้ทำอะไรในแอป | ทำไมใช้ scope ที่แคบกว่าไม่ได้ |
|---|---|---|---|
| `openid`, `email` | Non-sensitive | ระบุบัญชี Google ที่ผูก | — |
| `calendar.readonly` | Sensitive | นำเข้านัดมาแสดงในปฏิทินของแอป (P2-07) | เป็น scope อ่านอย่างเดียวที่แคบที่สุดแล้ว |
| `gmail.readonly` | **Restricted** | หาอีเมลที่ยังไม่ได้ตอบ และอ่านเนื้อหา thread เพื่อให้ AI สรุปและร่างคำตอบ **เมื่อผู้ใช้กดเปิด thread นั้นเอง** | `gmail.metadata` ไม่มีเนื้อหาเมล จึงสรุปหรือร่างคำตอบไม่ได้ |
| `gmail.compose` | **Restricted** | บันทึกคำตอบที่ผู้ใช้แก้แล้วเป็น **draft** ใน thread เดิม แอปไม่ส่งเมลเอง | Gmail ไม่มี scope ที่สร้าง draft ได้อย่างเดียว `drafts.create` ต้องใช้ `gmail.compose` เป็นอย่างน้อย |

Restricted scopes ต้องผ่าน **(1) OAuth app verification** และ **(2) CASA security assessment** โดย lab ที่ Google รับรอง และต้องประเมินซ้ำทุก 12 เดือน

## 2. Checklist ก่อนยื่น

**Branding / Consent screen** (Google Auth Platform → Branding)
- [ ] App name "Veyra", logo, support email
- [ ] Homepage URL บนโดเมนที่เป็นเจ้าของ (verify ใน Search Console แล้ว)
- [ ] Privacy policy URL บนโดเมนเดียวกัน (ดูข้อ 3)
- [ ] Terms of service URL
- [ ] Authorized domains: โดเมนของ homepage + `supabase.co` (redirect URI ของ `gcal` และ Supabase Auth)
- [ ] เปลี่ยน Publishing status เป็น **In production**

**Data access**
- [ ] ใส่ scope ครบตามตารางข้อ 1 ห้ามมี scope เกินที่ใช้จริง
- [ ] เขียน justification ต่อ scope (ใช้ข้อความจากข้อ 4)

**Demo video** (YouTube แบบ unlisted, ภาษาอังกฤษ)
- [ ] ดูข้อ 5

**CASA**
- [ ] หลังยื่น Google จะส่งอีเมลให้ทำ CASA → เลือก lab จากรายชื่อที่ Google ให้ (มีค่าใช้จ่าย ขอใบเสนอราคาล่าสุดจาก lab)
- [ ] เตรียมตอบเรื่อง: การเก็บ token (AES-GCM, key อยู่ใน Supabase secrets), RLS ของ `gcal_accounts`, ไม่เก็บเนื้อหาอีเมล, log ไม่มีเนื้อหาเมล, การ revoke ตอนลบบัญชี

**สิ่งที่ต้องทำให้เสร็จในแอปก่อนยื่น** (Phase 4 ข้ออื่น)
- [ ] PDPA: หน้า privacy policy + export / ลบบัญชี (ROADMAP) ลบบัญชีต้อง revoke token Google และลบแถว `gcal_accounts` ด้วย

## 3. ข้อความที่ต้องมีใน Privacy policy

ต้องมีประโยคนี้ตามตัวอักษร (Limited Use disclosure):

> Veyra's use and transfer to any other app of information received from Google APIs will adhere to the [Google API Services User Data Policy](https://developers.google.com/terms/api-services-user-data-policy), including the Limited Use requirements.

และต้องอธิบายให้ชัดว่า:
- อ่านข้อมูล Gmail อะไรบ้าง: หัวเรื่อง, ผู้ส่ง, snippet และเนื้อหาของ thread ที่ผู้ใช้เปิด
- ใช้ทำอะไร: แสดงอีเมลค้างตอบ, สรุป, ร่างคำตอบเป็น draft เท่านั้น
- **ไม่เก็บ**เนื้อหาอีเมลบน server, ไม่ใช้เพื่อโฆษณา, ไม่ขายต่อ, คนไม่ได้อ่าน (ยกเว้นผู้ใช้ยินยอมหรือจำเป็นทางกฎหมาย/ความปลอดภัย)
- เนื้อหา thread ที่ผู้ใช้เปิดจะถูกส่งไปยัง **Anthropic (Claude API)** เพื่อสรุปและร่างคำตอบ ในนามผู้ใช้ และไม่นำไปใช้ train โมเดลทั่วไป (ตรวจสอบกับ commercial terms ปัจจุบันของ Anthropic ก่อนเผยแพร่)
- วิธีเพิกถอนสิทธิ์: Settings → Google Calendar → Remove หรือ https://myaccount.google.com/permissions

## 4. Scope justification (ใช้ข้อความนี้ในฟอร์ม)

**gmail.readonly**
> Veyra is a personal assistant app. Its Inbox screen lists the user's own recent inbox threads that are still waiting on their reply (the latest message is from someone else). When the user opens one of these threads, Veyra reads its content so it can show a short summary and a suggested reply. Message content is fetched on demand, shown only to the user, and never stored on our servers. gmail.metadata is not sufficient because the summary and suggested reply need the message body.

**gmail.compose**
> After the user reviews and edits the suggested reply, Veyra saves it as a draft reply in the same Gmail thread (users.drafts.create). Veyra never sends email; the user sends the draft from Gmail. No narrower scope allows creating drafts.

**calendar.readonly**
> Veyra shows the user's Google Calendar events alongside their tasks in a single day view. Read-only; events are edited in Google Calendar.

## 5. Demo video script (~3 นาที)

1. เปิดแอป (production build หรือเว็บ) → แสดง URL หน้า consent ของ Google ให้เห็น **client_id** ในแถบที่อยู่
2. แสดงหน้า consent: app name, scopes ครบ 5 ตัว → กด Allow
3. Settings → เห็นบัญชีที่ผูก (Calendar)
4. เมนู More → **Inbox**: เห็นรายการอีเมลค้างตอบ (**gmail.readonly**)
5. แตะ thread → AI summary + ร่างคำตอบ → แก้ข้อความ → **Save as Gmail draft**
6. เปิด Gmail → Drafts → เห็น draft อยู่ใน thread เดิม และยังไม่ถูกส่ง (**gmail.compose**)
7. กด follow-up "In 3 days" → เห็น task ในหน้า Tasks
8. Settings → Remove บัญชี → แสดงว่าสิทธิ์ถูกถอนใน myaccount.google.com/permissions

## 6. ที่โค้ดรองรับไว้แล้ว (อ้างอิงตอนตอบ reviewer)

- ขอ scope เดียวชุดเดียวใน `gcal` `start` และ sign-in (`src/features/auth/google.ts`) ผู้ใช้เอา Gmail ออกได้ ปฏิทินยังใช้ได้
- `supabase/functions/gmail/index.ts`: อ่านสด ไม่มีตารางเก็บเมล, log เฉพาะ error message ไม่มีเนื้อหา
- Refresh token เข้ารหัส AES-GCM (`_shared/google.ts`), ตาราง RLS เปิดแบบไม่มี policy (อ่านได้เฉพาะ service role)
- Draft เท่านั้น ไม่มีโค้ดส่งเมล (`drafts.create`)
- Remove บัญชี = revoke token ที่ Google + ลบแถว (`gcal` `disconnect`)
