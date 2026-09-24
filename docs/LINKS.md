# Links — "เกี่ยวข้องกับ"

รากของ Personal Brain (SPEC §4): ผูก task ↔ contact ↔ transaction ↔ event ↔ note ↔ area ได้อิสระ
โค้ดอยู่ที่ `src/features/links/` (model → queries → components)

## 1. Data model

ตาราง `links` (SPEC §6.3) — เก็บ **ครั้งเดียว** ทิศ `from → to` แล้วอ่านได้จากทั้งสองฝั่ง

| คอลัมน์ | ความหมาย |
|---|---|
| `from_type`, `from_id` | record ต้นทาง (`task`, `note`, `transaction`, `contact`, `event`, `area`) |
| `to_type`, `to_id` | record ปลายทาง |
| `relation` | ความสัมพันธ์ (ดูตารางล่าง) |
| `deleted_at` | soft delete — ไม่ลบจริง เพื่อ sync (Phase 2) |

Index: `links_from_idx (from_type, from_id)` และ `links_to_idx (to_type, to_id)` ครอบทั้ง 2 ทิศ

### Relation vocabulary

| `relation` | ใครสร้าง | ทิศ | ฝั่ง `from` เห็นว่า | ฝั่ง `to` เห็นว่า |
|---|---|---|---|---|
| `with` | Quick Capture, ฟอร์มนัด "กับใคร", picker เลือกคน | record → contact | กับ | มีส่วนร่วม |
| `extracted` | Notes → Extract | note → task/event/transaction | แยกจากโน้ตนี้ | จากโน้ต |
| `related` | ผู้ใช้กด "เชื่อมโยง" | อะไรก็ได้ | เกี่ยวข้อง | เกี่ยวข้อง |

เพิ่ม relation ใหม่ได้โดยไม่ต้อง migrate: เพิ่มเคสใน `relationKey()` + i18n `links.rel_*` เท่านั้น
relation ที่ไม่รู้จักจะแสดงเป็น "เกี่ยวข้อง"

## 2. Query pattern

หลักคิด: **ถามจากมุมของ record ที่กำลังดู (`self`)** ไม่ใช่จากมุมของ link

```
self = { type: 'task', id }
   │
   ├─ 1. links WHERE (from = self) OR (to = self) AND deleted_at IS NULL   ← live (useLiveQuery)
   │        ↓ otherEnd(link, self)  →  { ref, direction: 'out' | 'in' }
   ├─ 2. resolveRefs(refs)  →  1 query ต่อ type: SELECT … WHERE id IN (…)  ← sync
   │        ↓ describe({ type, row }, lang)  →  { title, subtitle }
   └─ 3. sortRelated()  →  contact, event, task, transaction, note, area
```

| API (`queries.ts`) | ใช้เมื่อ |
|---|---|
| `useRelated(self)` | UI — live list, re-run เมื่อตาราง `links` เปลี่ยน; ส่ง `null` สำหรับ record ที่ยังไม่ save |
| `getRelated(self, lang)` | นอก React — Veyra engine, `ai-prep-meeting` (Phase 4) |
| `useLinkCandidates(type, q, self)` | picker — ค้นชื่อแบบ substring, ตัด `self` ออก |
| `addLink(from, to, relation?)` | idempotent — ถ้ามี link (ทิศใดก็ได้) อยู่แล้วคืน id เดิม; relation default = `with` ถ้าปลายทางเป็นคน |
| `removeLink(linkId)` | soft delete |

Helper เดิมใน `features/contacts/links.ts` (`setLinkedContact`, `findOrCreateContact`) ยังใช้ได้เหมือนเดิม — เป็น writer เฉพาะเคส "1 คนต่อ record"

### Trade-off ที่ตั้งใจ

- `useLiveQuery` ของ drizzle/expo-sqlite ฟังการเปลี่ยนแปลง **เฉพาะตารางหลัก** ของ query (`links`) ดังนั้น
  - เพิ่ม/ลบ link → อัปเดตทันที ✅
  - แก้ชื่อ record ปลายทาง → list ไม่ refresh จนกว่า component จะ mount ใหม่ (sheet ปิด/เปิด) — ยอมรับได้ใน Phase 1
- ไม่ใช้ `UNION ALL` ข้าม 6 ตารางใน query เดียว เพราะ `useLiveQuery` ไม่รองรับ raw SQL / subquery และ shape ของแต่ละตารางต่างกันมาก — resolve ทีละ type อ่านง่ายและเทสได้
- ปลายทางที่ถูก soft-delete จะหายจาก list เอง (resolve ไม่เจอ) โดยไม่ต้องลบ link ตาม → undo ในอนาคตทำได้

## 3. UI — `RelatedSection`

`src/features/links/components/related-section.tsx` — ใช้ใน task / event / transaction sheet และ note editor (เฉพาะ record ที่ save แล้ว)

```
🔗 เกี่ยวข้องกับ · 2
┌──────────────────────────────────────────┐
│ 👤  John Smith                           │
│     ผู้ติดต่อ · กับ · Partner · ABC Ltd   │
├──────────────────────────────────────────┤
│ 📄  Client meeting notes              ›  │  ✕
│     โน้ต · จากโน้ต · #work               │
└──────────────────────────────────────────┘
[ + เชื่อมโยง ]
```

- แถว = icon ตาม type (สีจาก `typeStyle`) + ชื่อ + `type · relation · subtitle`
- แตะแถว → เปิดหน้า detail (`routeFor`); contact/area ยังไม่มีหน้า → แสดงเฉยๆ
- ✕ → `removeLink` (soft delete) ทันที ไม่ผ่านปุ่ม Save ของฟอร์ม
- "เชื่อมโยง" → picker inline: chip เลือก type → ช่องค้นหา → แตะผลลัพธ์ = `addLink` แล้วปิด picker
- หน้า event ส่ง `types={['task','note','transaction']}` เพราะช่อง "กับใคร" จัดการ contact อยู่แล้ว
  (`setLinkedContact` แทนที่ link `with` ทั้งหมดตอน save — ถ้าเปิดให้เลือกคนใน picker จะโดนล้าง)

## 4. ต่อยอด

- หน้า contact/[id] และ area/[id] → เพิ่มเคสใน `routeFor()` ที่เดียว ส่วน `useRelated` ใช้ได้ทันที (ทิศ `in`)
- Universal search → ใช้ `resolveRefs` แสดง "เกี่ยวข้องกับ" ใต้ผลค้นหา
- `ai-ask` / `ai-prep-meeting` → `getRelated(event)` เป็น retrieval ก่อนส่งให้ Claude
