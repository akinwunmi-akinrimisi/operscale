# Default niche brief

This file is the fallback brief used by `apps/agent/src/lib/claude.ts` when the customer's selected niche does not match any of the dedicated `niche-briefs/<niche>.md` files.

Source of truth: `docs/specs/ai-brief-analysis.md`.

The default brief intentionally avoids niche-specific recommendations. It instructs Claude to:

- Treat the brief as a generic SMB and prioritise safety over specificity
- Avoid making any claims that could be construed as regulated (medical, financial, legal)
- Recommend a balanced 60/40 UGC/T2V mix with 2:1 video-to-carousel ratio
- Surface a flag of type `niche_unmapped` so the founder can review and consider adding a dedicated niche brief

Operational rule: any time we hit `_default.md` for a real customer, log the niche string and add a dedicated brief if the same niche appears 2+ times. Track this in the cost-monitoring weekly review (see `docs/runbooks/cost-monitoring.md`).

## Tone

Neutral, helpful, not aspirational beyond what a generic SMB can substantiate.

## Visual style defaults

- Palette: warm-neutral with one accent
- Typography: simple sans-serif, no decorative
- Camera treatment: handheld for UGC, locked-off for T2V, no luxury cinematography defaults

## Flags to apply

- `niche_unmapped` — informational; tells the founder this brief used the fallback path
