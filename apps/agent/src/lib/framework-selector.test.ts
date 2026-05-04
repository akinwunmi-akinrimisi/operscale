import { describe, it, expect } from 'vitest';
import { computeSeedHash, computeReanalyzeSeedHash, sortPairsByAffinityAndSeed } from './framework-selector';
import type { FrameworkSeedInputs, BankCatalog, NicheSlug, AffinityLevel } from './types/v2';

describe('computeSeedHash', () => {
  const inputs: FrameworkSeedInputs = {
    customer_id: '00000000-0000-0000-0000-000000000001',
    niche: 'beauty',
    order_index: 1,
    submission_week_iso: '2026-W18',
  };

  it('returns a 64-char hex string', () => {
    const hash = computeSeedHash(inputs);
    expect(hash).toMatch(/^[0-9a-f]{64}$/);
  });

  it('is deterministic across calls', () => {
    expect(computeSeedHash(inputs)).toBe(computeSeedHash(inputs));
  });

  it('changes when customer_id changes', () => {
    const a = computeSeedHash(inputs);
    const b = computeSeedHash({ ...inputs, customer_id: '00000000-0000-0000-0000-000000000002' });
    expect(a).not.toBe(b);
  });

  it('changes when order_index changes', () => {
    const a = computeSeedHash(inputs);
    const b = computeSeedHash({ ...inputs, order_index: 2 });
    expect(a).not.toBe(b);
  });

  it('changes when submission_week_iso changes', () => {
    const a = computeSeedHash(inputs);
    const b = computeSeedHash({ ...inputs, submission_week_iso: '2026-W19' });
    expect(a).not.toBe(b);
  });
});

describe('computeReanalyzeSeedHash', () => {
  const inputs: FrameworkSeedInputs = {
    customer_id: '00000000-0000-0000-0000-000000000001',
    niche: 'beauty',
    order_index: 1,
    submission_week_iso: '2026-W18',
  };

  it('returns a 64-char hex string distinct from the initial seed', () => {
    const initial = computeSeedHash(inputs);
    const reanalyze = computeReanalyzeSeedHash(inputs, 2);
    expect(reanalyze).toMatch(/^[0-9a-f]{64}$/);
    expect(reanalyze).not.toBe(initial);
  });

  it('changes when run_index changes', () => {
    const a = computeReanalyzeSeedHash(inputs, 2);
    const b = computeReanalyzeSeedHash(inputs, 3);
    expect(a).not.toBe(b);
  });
});

function makeAffinity(level: AffinityLevel): Record<NicheSlug, AffinityLevel> {
  return {
    beauty: level,
    real_estate: level,
    fashion: level,
    fintech: level,
    health: level,
    food: level,
    education: level,
  };
}

function makeMinimalCatalog(): BankCatalog {
  // Affinities chosen so there is a tie at combined score = 3:
  //   DR_FORMULA(High) × PRICING_BREAKDOWN(High) = 9
  //   DR_FORMULA(High) × SERVICE_ANATOMY(Low)    = 3   <- tie
  //   PAS(Low)         × PRICING_BREAKDOWN(High) = 3   <- tie
  //   PAS(Low)         × SERVICE_ANATOMY(Low)    = 1
  // The two tied pairs are where seed-based tie-breaking engages.
  return {
    frameworks: {
      DR_FORMULA:    { slot: 'DR_FORMULA', name: 'DR Formula', family: 'A', markdown: '', affinity: makeAffinity('High') },
      PAS:           { slot: 'PAS',        name: 'PAS',        family: 'A', markdown: '', affinity: makeAffinity('Low') },
    } as unknown as BankCatalog['frameworks'],
    archetypes: {
      PRICING_BREAKDOWN: { slot: 'PRICING_BREAKDOWN', name: 'Pricing Breakdown', family: 'A', markdown: '', affinity: makeAffinity('High') },
      SERVICE_ANATOMY:   { slot: 'SERVICE_ANATOMY',   name: 'Service Anatomy',   family: 'A', markdown: '', affinity: makeAffinity('Low') },
    } as unknown as BankCatalog['archetypes'],
    niches: {
      beauty: '', real_estate: '', fashion: '', fintech: '', health: '', food: '', education: '',
    },
  };
}

describe('sortPairsByAffinityAndSeed', () => {
  it('returns all 4 pairs from a 2x2 catalog', () => {
    const catalog = makeMinimalCatalog();
    const pairs = sortPairsByAffinityAndSeed(catalog, 'beauty', 'abc123');
    expect(pairs).toHaveLength(4);
  });

  it('orders pairs by combined affinity descending', () => {
    // Combined affinity (with tie at 3):
    //   DR_FORMULA(High=3) * PRICING_BREAKDOWN(High=3) = 9
    //   DR_FORMULA(High=3) * SERVICE_ANATOMY(Low=1)    = 3
    //   PAS(Low=1)         * PRICING_BREAKDOWN(High=3) = 3
    //   PAS(Low=1)         * SERVICE_ANATOMY(Low=1)    = 1
    const catalog = makeMinimalCatalog();
    const pairs = sortPairsByAffinityAndSeed(catalog, 'beauty', 'abc123');
    expect(pairs[0].affinity).toBe(9);
    expect(pairs[pairs.length - 1].affinity).toBe(1);
  });

  it('breaks affinity ties using hash(seed + framework + archetype)', () => {
    const catalog = makeMinimalCatalog();
    // Both seeds will produce the same affinity ordering on the top-affinity pair,
    // but tie-breaking among middle pairs (affinity 3 and 6) should reorder them
    // for different seeds.
    const a = sortPairsByAffinityAndSeed(catalog, 'beauty', 'seed-A');
    const b = sortPairsByAffinityAndSeed(catalog, 'beauty', 'seed-B');
    // The full ordering should differ for different seeds (at least somewhere)
    expect(JSON.stringify(a)).not.toBe(JSON.stringify(b));
  });

  it('is deterministic for a given seed', () => {
    const catalog = makeMinimalCatalog();
    const a = sortPairsByAffinityAndSeed(catalog, 'beauty', 'fixed-seed');
    const b = sortPairsByAffinityAndSeed(catalog, 'beauty', 'fixed-seed');
    expect(a).toEqual(b);
  });
});
