import { describe, it, expect } from 'vitest';
import { computeSeedHash, computeReanalyzeSeedHash } from './framework-selector';
import type { FrameworkSeedInputs } from './types/v2';

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
