import { describe, it, expect } from 'vitest';
import {
  FRAMEWORK_SLOTS,
  ARCHETYPE_SLOTS,
  NICHE_SLUGS,
  TIERS,
  TIER_COUNTS,
  AFFINITY_SCORES,
  type FrameworkSlot,
} from './v2';

describe('V2 canonical types', () => {
  it('exports exactly 25 framework slots', () => {
    expect(FRAMEWORK_SLOTS).toHaveLength(25);
  });

  it('exports exactly 25 archetype slots', () => {
    expect(ARCHETYPE_SLOTS).toHaveLength(25);
  });

  it('exports 7 niche slugs in canonical order', () => {
    expect(NICHE_SLUGS).toHaveLength(7);
    expect([...NICHE_SLUGS]).toEqual([
      'beauty', 'real_estate', 'fashion', 'fintech', 'health', 'food', 'education',
    ]);
  });

  it('TIER_COUNTS provides per-tier framework + archetype + video + carousel counts', () => {
    expect(TIER_COUNTS.starter).toEqual({ frameworks: 3, archetypes: 3, video_count: 7, carousel_count: 3 });
    expect(TIER_COUNTS.standard).toEqual({ frameworks: 5, archetypes: 5, video_count: 14, carousel_count: 7 });
    expect(TIER_COUNTS.calendar).toEqual({ frameworks: 8, archetypes: 8, video_count: 30, carousel_count: 14 });
  });

  it('TIER_COUNTS covers every tier in TIERS', () => {
    for (const tier of TIERS) {
      expect(TIER_COUNTS[tier]).toBeDefined();
    }
  });

  it('AFFINITY_SCORES preserves High > Med > Low ordering', () => {
    expect(AFFINITY_SCORES.High).toBeGreaterThan(AFFINITY_SCORES.Med);
    expect(AFFINITY_SCORES.Med).toBeGreaterThan(AFFINITY_SCORES.Low);
    expect(AFFINITY_SCORES.High).toBe(3);
    expect(AFFINITY_SCORES.Med).toBe(2);
    expect(AFFINITY_SCORES.Low).toBe(1);
  });

  it('framework slot strings follow UPPER_SNAKE_CASE', () => {
    for (const slot of FRAMEWORK_SLOTS) {
      expect(slot).toMatch(/^[A-Z][A-Z0-9]*(_[A-Z0-9]+)*$/);
    }
  });

  it('archetype slot strings follow UPPER_SNAKE_CASE', () => {
    for (const slot of ARCHETYPE_SLOTS) {
      expect(slot).toMatch(/^[A-Z][A-Z0-9]*(_[A-Z0-9]+)*$/);
    }
  });

  it('FrameworkSlot type narrows to a member of FRAMEWORK_SLOTS', () => {
    const x: FrameworkSlot = 'DR_FORMULA';
    expect(FRAMEWORK_SLOTS).toContain(x);
  });
});
