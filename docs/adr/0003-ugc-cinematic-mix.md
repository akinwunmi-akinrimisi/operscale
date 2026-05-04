# ADR 0003: UGC 60% / cinematic 40% mix on every tier

**Status:** Accepted, 3 May 2026.

## Context

Calendar content can be UGC-style (creator on camera, e.g. HeyGen) or cinematic T2V (text-to-video, e.g. Veo / Seedance). Each has different cost, latency, and effectiveness.

UGC strengths: feels native, drives trust, customer can be the face.
T2V strengths: visual variety, atmospheric, scales without face dependency.

## Decision

Every tier uses 60% UGC, 40% T2V. Locked. No customer choice.

- Starter (7 videos): 4 UGC + 3 T2V
- Standard (14 videos): 8 UGC + 6 T2V
- Calendar (30 videos): 18 UGC + 12 T2V

## Consequences

- Predictable margin (UGC and T2V have known costs).
- Customer can't tweak the mix. Reduces decision fatigue at the form.
- Customers who really need 100% UGC or 100% T2V are not our customer.
- Operations: predictable production-pipeline composition. Easier to balance HeyGen and fal.ai concurrency.
- Phase 2 may revisit if data shows certain niches benefit from different mixes.
