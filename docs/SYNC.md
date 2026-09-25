# Auth + Cloud sync (P2-08)

Supabase Auth (Apple / Google) + sync engine ตาม SPEC §6.5 — **local-first**: SQLite ในเครื่องเป็น source of truth, cloud เก็บสำเนาไว้ให้เครื่องอื่นดึง ใช้งานออฟไลน์ได้ทุกอย่าง ไม่ login ก็ใช้ได้ (แค่ไม่ backup)

## โครง

| ส่วน | ที่อยู่ |
|---|---|
| Supabase client + session | `src/features/auth/client.ts`, `store.ts` (`useAuth`, `signIn`, `signOut`, `startAuth`) |
| Sync engine | `src/features/sync/` — `tables.ts` (ตารางที่ซิงค์), `engine.ts` (กติกา, pure + test), `sync.ts` (push/pull), `auto-sync.tsx` (`<CloudSync/>`) |
| Server | `supabase/migrations/20260926000000_sync_rows.sql` — ตาราง `sync_rows` + RPC `sync_push` |
| UI | Settings → "Account & sync" |

## Sign-in

| แพลตฟอร์ม | Apple | Google |
|---|---|---|
| iOS | ปุ่มระบบ (`expo-apple-authentication`) → `signInWithIdToken` | Supabase OAuth ใน in-app browser (PKCE) → `exchangeCodeForSession` |
| Android | Supabase OAuth ใน browser | Supabase OAuth ใน browser |
| Web | redirect ไป provider แล้วกลับมาที่ `/settings?code=…` (supabase-js จบให้เอง) | เหมือนกัน |

Session เก็บใน expo-sqlite kv-store (native) / localStorage (web) และ refresh อัตโนมัติตอนแอปอยู่หน้าจอ ออกจากระบบ = เฉพาะเครื่องนี้ ข้อมูลในเครื่องยังอยู่

## Sync engine

- **ตารางที่ซิงค์** (`tables.ts`): areas, categories, wallets, contacts, routines, tasks, notes, transactions, recurring_bills, checkins, focus_sessions, links, assistant_messages — *ไม่ซิงค์* calendar_events / calendar_accounts (Google import ผูกกับเครื่อง ดึงเองได้) และคอลัมน์เฉพาะเครื่อง (`reminder_notification_id`)
- **Payload**: แถว SQLite ทั้งแถว (ชื่อคอลัมน์ตาม schema, JSON เป็น string, boolean 0/1) เก็บเป็น `jsonb` ใน `sync_rows(user_id, table_name, id, data, updated_at, deleted_at, server_seq)` — ตารางเดียวใช้กับทุก table เพิ่มตารางใหม่ในแอปแค่เพิ่มใน `tables.ts`
- **Push**: แถวที่ `synced_at IS NULL OR updated_at > synced_at` → RPC `sync_push` (upsert, server เก็บเฉพาะ `updated_at` ที่ใหม่กว่า) → ตั้ง `synced_at = updated_at` เฉพาะแถวที่ไม่ถูกแก้ระหว่างส่ง
- **Pull**: `server_seq > cursor` (cursor ต่อ user เก็บใน kv-store) ทีละ 500 แถว; `server_seq` ขยับทุกครั้งที่แถวเปลี่ยน และ push ของ user เดียวกันถูก serialise ด้วย advisory lock จึงไม่มีแถวหลุด
- **Conflict**: last-write-wins ตาม `updated_at` ทั้งสองฝั่ง (`engine.decide`): local ใหม่กว่า → เก็บ local (เดี๋ยว push ไปชนะ), เท่ากันและ synced แล้ว → แถวตัวเองสะท้อนกลับ ข้าม
- **Delete**: soft delete (`deleted_at`) เหมือนทั้งแอป
- **เครื่องใหม่ / seed ซ้ำ**: ทุกเครื่อง seed areas/categories/wallets ด้วย id ใหม่ → pull ครั้งแรก แถว seed ที่ยังไม่เคย push และชื่อตรงกับของ cloud จะถูกแทนด้วย id ของ cloud และแก้ reference (area_id, category_id, wallet_id, links) ตาม (`planSeedMerge`) — ข้อมูลตัวอย่างจาก onboarding ไม่ dedupe จึงแนะนำให้ login ก่อนเพิ่มตัวอย่างบนเครื่องใหม่
- **checkins.date UNIQUE**: ถ้าเครื่องสองเครื่องเช็คอินวันเดียวกัน แถวที่ใหม่กว่าชนะ
- **เปลี่ยนบัญชี**: login ด้วย user คนละคนกับครั้งก่อน → ล้างตารางที่ซิงค์ในเครื่องแล้วดึงของ user ใหม่ (ข้อมูลที่ยังไม่ได้ push ของคนเก่าหาย)
- **เมื่อไหร่ซิงค์** (`auto-sync.tsx`): login / เปิดแอป, กลับมาหน้าจอ (pull ห่างกัน ≥1 นาที), 2.5 วิหลังเขียนข้อมูลในเครื่อง (push อย่างเดียว), ปุ่ม Sync now
- ยังไม่มี realtime — เครื่องอื่นเห็นตอนเปิดแอป/กลับมาหน้าจอ

## Setup

1. **Migration**: `npx supabase db push` (สร้าง `sync_rows`, `sync_push`)
2. **Supabase Dashboard → Authentication → Providers**
   - **Google**: Client ID/Secret จาก Google Cloud (OAuth client type *Web application*, redirect URI `https://<project-ref>.supabase.co/auth/v1/callback`) — ใช้ client เดียวกับ gcal ได้ แต่ต้องเพิ่ม redirect URI นี้
   - **Apple**: Services ID + Team ID + Key ID + private key (.p8) สำหรับ web/Android; iOS native ใช้ bundle id `com.proud.assistant` (ต้องใส่ใน *Authorized Client IDs*)
3. **Authentication → URL Configuration → Redirect URLs** ใส่ทุก URL ที่แอปกลับมา:
   - `veyra://settings` (dev build / production)
   - `https://<your-site>.netlify.app/settings` และ `http://localhost:8081/settings` (web)
   - `exp://…/--/settings` ตอนใช้ Expo Go (ดูค่าจริงจาก `Linking.createURL('/settings')`)
4. `.env`: `EXPO_PUBLIC_SUPABASE_URL`, `EXPO_PUBLIC_SUPABASE_ANON_KEY` (ตัวเดียวกับ AI / gcal)
5. iOS: `app.json` มี `ios.usesAppleSignIn` + plugin `expo-apple-authentication` แล้ว → ต้อง development build ใหม่ (`npx expo run:ios` / `eas build`) และเปิด capability *Sign in with Apple* ใน Apple Developer

## ต่อยอด

- `ai_usage` / `gcal_accounts` ยังผูก device key — ส่ง user JWT ไป Edge Functions แล้วย้าย owner เป็น `user_id`
- Realtime (Supabase Realtime บน `sync_rows`) ถ้าอยากเห็นทันทีข้ามเครื่อง
- Export / ลบบัญชี (PDPA, Phase 4) = ลบ `auth.users` → `sync_rows` cascade
