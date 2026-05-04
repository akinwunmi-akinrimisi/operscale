# ADR 0002: fal.ai as the primary video generation API (Phase 2)

**Status:** Accepted, 2 May 2026 (carried forward from operscale-video-ads ADR 0019).

## Context

Phase 2 will need text-to-video generation for the cinematic 40% of calendar content. The major options are:

- fal.ai (aggregator with Veo, Seedance, Kling, Luma access)
- Direct API access to each model provider
- Replicate (similar aggregator)
- Self-hosted (RunPod with ComfyUI + Wan 2.2)

## Decision

fal.ai is the primary T2V API for Phase 2.

We use Veo 3.1 Fast at $0.10/s as the quality lane, Seedance 2.0 Fast at $0.022/s as the budget lane. Per-video cost averages ~$2.20 at 30s.

## Consequences

- Single API integration covers multiple model providers. We can switch models without changing integration code.
- Fal queues async jobs; we work with webhooks. Adds asynchrony to the production pipeline.
- Concurrency cap (15-25 concurrent jobs by default). Phase 1 doesn't hit this; Phase 2 will need a queue.
- We accept the markup over going direct. Convenience > savings at this volume.
- Self-hosted alternative remains under evaluation; if fal pricing changes substantially, we re-evaluate.
