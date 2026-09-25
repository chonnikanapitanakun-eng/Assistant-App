# Veyra — Your life, handled.

เลขาส่วนตัวภาษาไทย: จดบันทึก + ตารางงาน + รายรับรายจ่าย + AI
Expo (React Native) · TypeScript · SQLite (Drizzle) · Supabase (Phase 2)

- Spec: [docs/SPEC.md](docs/SPEC.md)
- Roadmap: [docs/ROADMAP.md](docs/ROADMAP.md)

## Run

```bash
npm install
npm run android         # = npx expo run:android — build + ติดตั้ง development build (Expo Go ไม่พอ: มี native module เช่น expo-speech-recognition, widgets)
npm run ios             # = npx expo run:ios บน macOS
npx expo start          # dev server สำหรับ development build ที่ติดตั้งไว้แล้ว
npx expo start --web    # เว็บ: ข้อมูลเก็บใน browser (OPFS) — ยังไม่มี FTS5 จึงค้นหา (Search) ไม่เจออะไร และไม่มี notification
```

## Checks

```bash
npm run typecheck
npm run lint
npm test
npm run db:generate     # หลังแก้ src/db/schema.ts
```

## Structure

```
src/app/          Expo Router screens  ((tabs)/, capture.tsx, assistant.tsx)
src/components/   ui/ (design-system primitives), brand/ (logo, mascot), navigation/ (tab bar, sidebar)
src/db/           Drizzle schema, migrations, FTS, seed
src/features/     tasks / notes / money / contacts / areas / search / ai / privacy (PDPA: export, erase, delete account)
src/i18n/         th.json, en.json
src/lib/          date, currency, ids
src/theme/        Veyra design tokens (colour, type, spacing, radius, shadow, motion), useTheme, useBreakpoint
supabase/         Edge Functions (AI)
docs/             SPEC, ROADMAP
```
