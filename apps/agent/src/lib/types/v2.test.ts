import { describe, it, expect } from 'vitest';
import {
  FRAMEWORK_SLOTS,
  ARCHETYPE_SLOTS,
  NICHE_SLUGS,
  TIER_COUNTS,
  type FrameworkSlot,
  type ArchetypeSlot,
  type NicheSlug,
  type Tier,
} from './v2';

describe('V2 canonical types', () => {
  it('exports exactly 25 framework slots', () => {
    expect(FRAMEWORK_SLOTS).toHaveLength(25);
  });

  it('exports exactly 25 archetype slots', () => {
    expect(ARCHETYPE_SLOTS).toHaveLength(25);
  });

  it('exports 7 niche slugs', () => {
    expect(NICHE_SLUGS).toHaveLength(7);
    expect(NICHE_SLUGS).toEqual(
      expect.arrayContaining(['beauty', 'real_estate', 'fashion', 'fintech', 'health', 'food', 'education']),
    );
  });

  it('TIER_COUNTS provides per-tier framework + archetype counts', () => {
    expect(TIER_COUNTS.starter).toEqual({ frameworks: 3, archetypes: 3, video_count: 7, carousel_count: 0 });
    expect(TIER_COUNTS.standard).toEqual({ frameworks: 5, archetypes: 5, video_count: 14, carousel_count: 0 });
    expect(TIER_COUNTS.calendar).toEqual({ frameworks: 8, archetypes: 8, video_count: 30, carousel_count: 0 });
  });

  it('framework slot strings follow UPPER_SNAKE_CASE', () => {
    for (const slot of FRAMEWORK_SLOTS) {
      expect(slot).toMatch(/^[A-Z][A-Z0-9_]*$/);
    }
  });

  it('archetype slot strings follow UPPER_SNAKE_CASE', () => {
    for (const slot of ARCHETYPE_SLOTS) {
      expect(slot).toMatch(/^[A-Z][A-Z0-9_]*$/);
    }
  });

  it('FrameworkSlot type narrows to a member of FRAMEWORK_SLOTS', () => {
    const x: FrameworkSlot = 'DR_FORMULA';
    expect(FRAMEWORK_SLOTS).toContain(x);
  });
});
