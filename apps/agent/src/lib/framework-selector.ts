import { createHash } from 'node:crypto';
import type { FrameworkSeedInputs } from './types/v2';

/**
 * Deterministic per-customer seed.
 * Source: docs/specs/non-duplication-system.md §2.
 *
 *   seed_input = customer_id + "::" + niche + "::" + order_index + "::" + submission_week_iso
 *   seed       = sha256(seed_input)
 */
export function computeSeedHash(inputs: FrameworkSeedInputs): string {
  const seedInput = `${inputs.customer_id}::${inputs.niche}::${inputs.order_index}::${inputs.submission_week_iso}`;
  return createHash('sha256').update(seedInput).digest('hex');
}

/**
 * Re-analyze (new frameworks) seed.
 * Source: docs/specs/non-duplication-system.md §7.2.
 *
 *   new_seed_input = customer_id + "::" + niche + "::" + order_index + "::"
 *                  + submission_week_iso + "::reanalyze::" + new_run_index
 */
export function computeReanalyzeSeedHash(inputs: FrameworkSeedInputs, runIndex: number): string {
  const seedInput = `${inputs.customer_id}::${inputs.niche}::${inputs.order_index}::${inputs.submission_week_iso}::reanalyze::${runIndex}`;
  return createHash('sha256').update(seedInput).digest('hex');
}
