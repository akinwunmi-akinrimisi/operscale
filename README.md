# Operscale Content Calendar Platform

Phase 1 build for the Operscale content calendar service. This repo contains the marketing site, intake form, AI brief analysis service, internal CRM, and all supporting infrastructure for selling and managing 7/14/30-day video + carousel content packages to Nigerian SMBs.

This is a **standalone** repo. It is operationally co-located with Vision GridAI (shares the same VPS, Supabase project, and Evolution API instance) but is its own codebase, its own brand surface, and its own customer journey.

## What this build is

A customer arrives at the marketing site, picks one of three calendar tiers (Starter / Standard / Calendar), fills a 7-step intake form, optionally uploads up to 3 face photos for a custom AI avatar, and submits. The submission triggers an instant auto-acknowledgement email and an AI brief analysis. The analysis lands in our internal CRM as `pending_review`. The founder reviews the analysis, edits inline or re-analyzes with a note, then approves. The customer receives a personalised brief email with a Paystack payment link. They pay in NGN, the webhook fires, the order moves to `paid`, and the customer receives email and WhatsApp confirmation. Phase 2 production picks up from there.

Phase 1 ends at `paid`. Phase 2 (a separate repo or directory, TBD) covers the actual video and carousel production.

## Repo layout

```
operscale-calendar-platform/
├── README.md                       # This file
├── CLAUDE.md                       # Operating doc for Claude Code sessions
├── AGENT.md                        # State machine and per-state contracts
├── skills.md                       # Index of installed skills and what each does
├── skills.sh                       # Idempotent installer for environment + skills
│
├── apps/                           # Application code (created by skills.sh)
│   ├── web/                        # Next.js 15 — marketing, form, admin CRM
│   └── agent/                      # Next.js API routes — brief analysis, webhooks
│
├── docs/
│   ├── architecture.md             # VPS topology, container layout, env vars
│   ├── implementation.md           # 22-day build plan with daily tasks
│   ├── deployment.md               # Docker Compose, Traefik, deploy workflow
│   ├── data-model.md               # Full schema with v2 tables and relationships
│   ├── security.md                 # Trust boundaries, JWT chain, photo handling
│   ├── customer-journey.md         # 9-state customer flow with drop-off recovery
│   ├── pricing-and-packages.md     # Tier structure, COGS, margin guard
│   ├── content-mix-playbook.md     # 60% UGC / 40% T2V rationale and patterns
│   │
│   ├── specs/
│   │   ├── ai-brief-analysis.md    # Prompt, JSON schema, vision blocks
│   │   ├── founder-review-flow.md  # CRM review workflow, edits, re-analyze
│   │   ├── photo-upload-and-retention.md
│   │   ├── paystack-integration.md # HMAC, webhooks, refunds, idempotency
│   │   ├── email-templates.md      # Auto-ack, brief, confirmation, recovery
│   │   ├── whatsapp-flow.md        # Evolution API integration
│   │   ├── ndpc-compliance.md      # Registration, retention, customer rights
│   │   └── calendar-preview-on-pricing-page.md
│   │
│   ├── runbooks/
│   │   └── crm-runbook.md          # How to use the CRM day-to-day
│   │
│   ├── diagrams/
│   │   ├── customer-journey.mmd
│   │   ├── founder-review-flow.mmd
│   │   ├── data-model.mmd
│   │   └── photo-lifecycle.mmd
│   │
│   └── adr/
│       ├── 0001-standalone-repo.md
│       ├── 0002-fal-as-primary-video-api.md
│       ├── 0003-ugc-cinematic-mix.md
│       ├── 0004-founder-reviews-ai-before-send.md
│       ├── 0005-carousels-bundled.md
│       ├── 0006-customer-photo-collection.md
│       ├── 0007-no-customer-dashboard.md
│       ├── 0008-internal-crm-not-notion.md
│       └── 0009-instant-auto-ack-then-founder-approval.md
│
├── niche-briefs/                   # Operational knowledge per industry niche
│   ├── beauty.md
│   ├── real-estate.md
│   ├── fashion-ecom.md
│   ├── fintech.md
│   ├── health.md
│   ├── food.md
│   ├── education.md
│   └── restricted.md
│
├── supabase/
│   ├── migrations/                 # Schema migrations (numbered, immutable)
│   └── functions/                  # Edge Functions: photo-retention, recovery
│
├── scripts/                        # Utility scripts (deploy, seed, smoke tests)
└── .github/workflows/              # CI: brand-name grep check, SQL lint, type check
```

## Where a new session starts

1. Read `CLAUDE.md` first. It explains the methodology, the 12 inherited gotchas, and the rules for how Claude Code operates in this repo.
2. Read `AGENT.md` second. It is the state machine — every state in the customer journey, what writes happen, what side-effects fire, what gets logged.
3. Run `skills.sh` to install the environment. Idempotent — safe to re-run.
4. Read `skills.md` to know which skills are available and when each one applies.
5. Pick a task from `docs/implementation.md` or from the open issues, then read the relevant spec under `docs/specs/`.

## Operational constraints (non-negotiable)

- **Same VPS.** This service runs on `srv1297445.hstgr.cloud` (the Hostinger KVM 4 we have used for previous projects). Do not provision new infrastructure.
- **Same Supabase project.** The Phase 1 v2 schema migrations create new tables alongside the existing Vision GridAI tables. They do not modify or delete existing tables.
- **Same Evolution API.** WhatsApp goes through the existing Evolution API instance.
- **Brand placeholder.** Customer-facing brand name is `Operscale` everywhere until the launch decision. `grep -r 'Operscale' .` must pass cleanly in CI before launch.
- **API keys never hardcoded.** Reference existing n8n credentials or `$getWorkflowStaticData` patterns. Plain-text keys in any committed file is a build-blocker.
- **NDPC compliance.** No personal data is processed in production until NDPC registration is complete. Test data only during build.

## Status

- Repo: scaffolded
- Marketing site: not started
- Intake form: not started
- AI brief analysis: not started
- Internal CRM: not started
- Paystack integration: not started
- WhatsApp: not started
- NDPC filing: not submitted
- Brand name: not locked

Update this section as work lands. The status block is the canonical source of truth for "where are we."

## Owners

- Product: Akinwunmi Akinrimisi
- Build: Akinwunmi Akinrimisi (with Claude Code)
- Reviewer: Akinwunmi Akinrimisi (with Claude Code)

## License

Proprietary. All rights reserved, Operscale Limited.
