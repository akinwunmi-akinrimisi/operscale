import { describe, it, expect } from 'vitest';
import { computeIdempotencyKey } from './idempotency-key';

describe('computeIdempotencyKey', () => {
  it('returns brief_id::initial::0 for trigger_type=initial', () => {
    const key = computeIdempotencyKey({
      brief_id: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
      trigger_type: 'initial',
    });
    expect(key).toBe('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa::initial::0');
  });

  it('returns brief_id::re_analyze_same_frameworks::3 for re-analysis with prior_run_index=3', () => {
    const key = computeIdempotencyKey({
      brief_id: 'b1',
      trigger_type: 're_analyze_same_frameworks',
      prior_run_index: 3,
    });
    expect(key).toBe('b1::re_analyze_same_frameworks::3');
  });

  it('throws when trigger_type is re_analyze_* and prior_run_index is missing', () => {
    expect(() =>
      computeIdempotencyKey({ brief_id: 'b1', trigger_type: 're_analyze_new_frameworks' }),
    ).toThrow(/prior_run_index/i);
  });
});
