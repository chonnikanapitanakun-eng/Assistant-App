import { describe, expect, it } from 'vitest';

import { isWanPhra, isWanPhraDateKey, thaiMoonPhase, thaiMoonPhaseForDateKey } from '../thai-lunar';

describe('thai-lunar', () => {
  it('identifies known full-moon Buddhist holidays as full_moon', () => {
    // วันวิสาขบูชา 2568, วันมาฆบูชา 2569, วันอาสาฬหบูชา 2568 — ทุกวันเป็นวันเพ็ญ (ขึ้น 15 ค่ำ) ตามประกาศทางการ
    expect(thaiMoonPhase(new Date(2025, 4, 11))).toBe('full_moon');
    expect(thaiMoonPhase(new Date(2026, 2, 3))).toBe('full_moon');
    expect(thaiMoonPhase(new Date(2025, 6, 10))).toBe('full_moon');
  });

  it('is null on an ordinary day far from a quarter phase', () => {
    // สามวันหลังเพ็ญ ควรยังไม่ถึงจุดใดๆ ของวันพระถัดไป
    expect(thaiMoonPhase(new Date(2025, 4, 14))).toBeNull();
  });

  it('isWanPhra mirrors thaiMoonPhase !== null', () => {
    expect(isWanPhra(new Date(2025, 4, 11))).toBe(true);
    expect(isWanPhra(new Date(2025, 4, 14))).toBe(false);
  });

  it('produces four moon-day clusters per synodic month (new/waxing/full/waning)', () => {
    const phases = new Set<string>();
    for (let d = 1; d <= 31; d++) {
      const p = thaiMoonPhase(new Date(2025, 4, d));
      if (p) phases.add(p);
    }
    expect(phases).toEqual(new Set(['new_moon', 'waxing_quarter', 'full_moon', 'waning_quarter']));
  });

  it('date-key helpers match the Date-based ones', () => {
    expect(thaiMoonPhaseForDateKey('2025-05-11')).toBe(thaiMoonPhase(new Date(2025, 4, 11)));
    expect(isWanPhraDateKey('2025-05-11')).toBe(true);
  });
});
