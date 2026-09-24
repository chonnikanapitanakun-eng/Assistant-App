# Proud Assistant

เลขาส่วนตัวภาษาไทย: จดบันทึก + ตารางงาน + รายรับรายจ่าย + AI
Expo (React Native) · TypeScript · SQLite (Drizzle) · Supabase (Phase 2)

- Spec: [docs/SPEC.md](docs/SPEC.md)
- Roadmap: [docs/ROADMAP.md](docs/ROADMAP.md)

## Run

```bash
npm install
npx expo start          # dev server (Expo Go ไม่พอ ต้องใช้ development build เพราะมี expo-sqlite)
npx expo run:android    # หรือ run:ios บน macOS
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
src/app/          Expo Router screens  ((tabs)/, capture.tsx)
src/components/   UI primitives (Screen, Text, Card, Fab)
src/db/           Drizzle schema, migrations, FTS, seed
src/features/     tasks / notes / money / contacts / areas / search / ai
src/i18n/         th.json, en.json
src/lib/          date, currency, ids
src/theme/        tokens (Navy/Silver), useTheme
supabase/         Edge Functions (AI)
docs/             SPEC, ROADMAP
```
