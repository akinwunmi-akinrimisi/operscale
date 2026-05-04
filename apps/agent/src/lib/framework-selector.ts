import { createHash } from 'node:crypto';
import type {
  FrameworkSeedInputs,
  BankCatalog,
  FrameworkSlot,
  ArchetypeSlot,
  NicheSlug,
  SelectedPair,
} from './types/v2';
import { AFFINITY_SCORES } from './types/v2';

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

/**
 * Sort all framework × archetype pairs by combined affinity (descending),
 * breaking ties with sha256(seed + "::" + framework + "::" + archetype) ascending.
 *
 * Source: docs/specs/non-duplication-system.md §3.
 *
 * Returns all pairs sorted; the caller filters by history exclusion and
 * walks the list to pick the required count.
 */
export function sortPairsByAffinityAndSeed(
  catalog: BankCatalog,
  niche: NicheSlug,
  seedHash: string,
): SelectedPair[] {
  const frameworkSlots = Object.keys(catalog.frameworks) as FrameworkSlot[];
  const archetypeSlots = Object.keys(catalog.archetypes) as ArchetypeSlot[];

  const pairs: Array<SelectedPair & { tieBreaker: string }> = [];
  for (const f of frameworkSlots) {
    const fAff = AFFINITY_SCORES[catalog.frameworks[f].affinity[niche]];
    for (const a of archetypeSlots) {
      const aAff = AFFINITY_SCORES[catalog.archetypes[a].affinity[niche]];
      const tieBreaker = createHash('sha256').update(`${seedHash}::${f}::${a}`).digest('hex');
      pairs.push({ framework: f, archetype: a, affinity: fAff * aAff, tieBreaker });
    }
  }

  pairs.sort((x, y) => {
    if (x.affinity !== y.affinity) return y.affinity - x.affinity;
    return x.tieBreaker < y.tieBreaker ? -1 : x.tieBreaker > y.tieBreaker ? 1 : 0;
  });

  // Strip the tieBreaker from the public-shape result.
  return pairs.map(({ framework, archetype, affinity }) => ({ framework, archetype, affinity }));
}
