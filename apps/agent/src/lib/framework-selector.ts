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

export interface HistoryRow {
  framework: FrameworkSlot;
  archetype: ArchetypeSlot;
  last_used_at: string; // ISO timestamp
}

export interface SelectionFromSortedResult {
  selected_frameworks: FrameworkSlot[];
  selected_archetypes: ArchetypeSlot[];
  selected_pairs: SelectedPair[];
  exhaustion_warning: boolean;
  lru_fallback_used: boolean;
  lru_pairs_reused?: Array<{ framework: FrameworkSlot; archetype: ArchetypeSlot; last_used_at: string }>;
}

function pairKey(p: { framework: FrameworkSlot; archetype: ArchetypeSlot }): string {
  return `${p.framework}::${p.archetype}`;
}

/**
 * Walk the sorted pair list, accumulate pairs that satisfy:
 *   - not in history
 *   - introduce a new framework OR archetype until both quotas are met
 *
 * If the available pool is too thin to satisfy the quota, fill the gap with
 * LRU pairs from history (sorted by last_used_at ASC).
 *
 * Source: docs/specs/non-duplication-system.md §3 (selection algorithm), §6 (exhaustion).
 */
export function selectPairsFromSorted(
  sortedPairs: SelectedPair[],
  history: HistoryRow[],
  nFrameworks: number,
  nArchetypes: number,
): SelectionFromSortedResult {
  const historyKeys = new Set(history.map(pairKey));
  const availablePairs = sortedPairs.filter((p) => !historyKeys.has(pairKey(p)));

  const requiredCount = Math.max(nFrameworks, nArchetypes);
  const exhaustion_warning =
    availablePairs.length < 2 * requiredCount && availablePairs.length >= requiredCount;

  const selectedPairs: SelectedPair[] = [];
  const seenFrameworks = new Set<FrameworkSlot>();
  const seenArchetypes = new Set<ArchetypeSlot>();

  for (const pair of availablePairs) {
    if (seenFrameworks.size >= nFrameworks && seenArchetypes.size >= nArchetypes) {
      break;
    }
    const newF = !seenFrameworks.has(pair.framework);
    const newA = !seenArchetypes.has(pair.archetype);
    if (
      (newF && seenFrameworks.size < nFrameworks) ||
      (newA && seenArchetypes.size < nArchetypes)
    ) {
      selectedPairs.push(pair);
      seenFrameworks.add(pair.framework);
      seenArchetypes.add(pair.archetype);
    }
  }

  let lru_pairs_reused: SelectionFromSortedResult['lru_pairs_reused'];

  if (seenFrameworks.size < nFrameworks || seenArchetypes.size < nArchetypes) {
    // Fall back to LRU history pairs to fill the quotas.
    const lruSorted = [...history].sort((a, b) => a.last_used_at.localeCompare(b.last_used_at));
    lru_pairs_reused = [];
    for (const h of lruSorted) {
      if (seenFrameworks.size >= nFrameworks && seenArchetypes.size >= nArchetypes) {
        break;
      }
      const newF = !seenFrameworks.has(h.framework);
      const newA = !seenArchetypes.has(h.archetype);
      if (
        (newF && seenFrameworks.size < nFrameworks) ||
        (newA && seenArchetypes.size < nArchetypes)
      ) {
        selectedPairs.push({ framework: h.framework, archetype: h.archetype, affinity: 0 });
        lru_pairs_reused.push({
          framework: h.framework,
          archetype: h.archetype,
          last_used_at: h.last_used_at,
        });
        seenFrameworks.add(h.framework);
        seenArchetypes.add(h.archetype);
      }
    }
  }

  return {
    selected_frameworks: [...seenFrameworks],
    selected_archetypes: [...seenArchetypes],
    selected_pairs: selectedPairs,
    exhaustion_warning,
    lru_fallback_used: lru_pairs_reused !== undefined && lru_pairs_reused.length > 0,
    lru_pairs_reused,
  };
}
