# ADR 0006: Customer face photo collection in Phase 1, used in Phase 2

**Status:** Accepted, 3 May 2026.

## Context

Phase 2 will use HeyGen custom avatars in UGC videos. Custom avatars need 3 reference photos. Two timing options:

A. Collect at form-fill (Phase 1).
B. Ask after payment, before production (Phase 2).

Option A: photos available when production starts; no second customer interruption. But: photos are sensitive personal data, require explicit consent under NDPC, require secure storage.

Option B: simpler privacy story; we only hold photos from paying customers. But: production blocks until customer responds; many customers will delay.

## Decision

Photos are collected at form step 5 (Phase 1), OPTIONAL (skip = stock AI presenter). Stored privately in Supabase Storage with explicit hashed-text consent. Retention: 90 days from delivery, or 30 days if no order. Daily cron sweep for deletion.

Phase 1 uses photos for AI brief analysis (vision-based aesthetic feedback). Phase 2 uses them for HeyGen avatar creation.

## Consequences

- Production starts immediately when payment is received — no second customer touch.
- NDPC compliance burden up-front: consent text, retention policy, deletion mechanism, daily sweep, customer rights.
- Photo opt-in rate becomes a Phase 1 KPI (target ≥ 40%).
- Storage cost is negligible (~1 GB/month at 100 customers).
- Vision API cost: photos add ~$0.07 per AI brief analysis call. ~$2/day at 30 briefs/day. Trivial.
- Customer trust depends on us holding the line on retention. Any breach of the 90-day promise damages trust permanently.
