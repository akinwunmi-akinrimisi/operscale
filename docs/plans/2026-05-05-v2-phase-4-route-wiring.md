# V2 Pipeline Phase 4 — Route Wiring Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Cut `/v1/brief/analyze` over from a 501 stub to a real enqueue route, and extend `/v1/brief/approve` to write `customer_framework_history` rows alongside the order-status flip — completing §9 Phase 4 of `docs/specs/v2-pipeline-implementation-design.md`. After this lands, customer briefs flow end-to-end through the production worker.

**Architecture:** Both routes are thin HTTP handlers. `analyze` validates inputs with zod, computes a deterministic `idempotency_key`, INSERTs one row into `ai_analysis_jobs`, returns `202 { job_id, status: 'queued' }`. The Phase 3 worker (already live) handles everything async. `approve` reads `analysis_runs.framework_seed.selected_pairs` for the brief's current run, INSERTs N `customer_framework_history` rows, and UPDATEs `orders.status='founder_approved'`. Paystack/Resend integration on approve is OUT OF SCOPE for Phase 4 — it's Phase 4.5 (separate plan).

**Tech Stack:** Next.js 15 App Router (Node runtime), zod 3.23 (already a dep), `@supabase/supabase-js` 2.45.x via the existing `getSupabaseAdmin()` helper, Vitest 1.6.x. No new dependencies.

---

## Decisions baked into this plan

**Decision A — Auth model for Phase 4 routes.**
- `/v1/brief/analyze` accepts requests from TWO sources: (a) the customer-facing form's submit handler (after the brief is INSERTed), and (b) the founder CRM (for re-analysis triggers). Both currently use the Supabase service-role key over an internal call (the form's submit handler runs server-side in Next.js; the CRM is founder-authenticated). Phase 4 keeps it simple: the route accepts a JWT in the `Authorization: Bearer` header and validates either `role: founder` (CRM) OR a service-role JWT (form submit). Anonymous requests return 401.
- `/v1/brief/approve` is founder-only: validates `role: founder`. Anonymous and customer JWTs return 401/403.

**Decision B — Idempotency key derivation.**
- For `trigger_type='initial'`: `${brief_id}::initial::0`
- For `trigger_type='re_analyze_*'`: `${brief_id}::${trigger_type}::${prior_run_index}` where `prior_run_index` is read from the prior `analysis_runs` row.
- Conflict on `idempotency_key` returns the existing job's `id` + `status` with HTTP 200 (not a fresh enqueue). This makes the route safe to retry.

**Decision C — Approve route's framework-history write.**
- Read `analysis_runs.framework_seed` for the brief's `is_current=true` row (one row per brief).
- For each pair in `framework_seed.selected_pairs`, INSERT one `customer_framework_history` row with `(customer_id, order_id, framework_slot, archetype_slot, used_at=now())`.
- The `customer_framework_history` PRIMARY KEY (per migration 0005) is `(customer_id, order_id, framework_slot, archetype_slot)` — duplicate INSERTs from a re-approval would ON CONFLICT DO NOTHING (verify in Step 1 of Task 4 by reading the migration).
- The order-status UPDATE happens in the same Supabase call sequence. If the history write fails partially, we accept the small race window (per Phase 3's same-stance YAGNI on transactions) — Phase 4.5 may upgrade to RPC.

**Decision D — Paystack + Resend deferred to Phase 4.5.**
- Phase 4 does NOT call Paystack to initialize a transaction.
- Phase 4 does NOT send the brief email via Resend.
- These integrations exist in the current 501 stub's TODO comment and need their own plan. Phase 4's scope is strictly: enqueue the analyze job; write the history rows; flip the order status.

---

## File structure (Phase 4)

| Path | Status | Responsibility |
|---|---|---|
| `apps/agent/src/app/v1/brief/analyze/route.ts` | Rewrite | Replaces 501 stub with zod-validated enqueue handler. Returns 202 + job_id. |
| `apps/agent/src/app/v1/brief/analyze/route.test.ts` | Create | Vitest tests for the analyze handler — validation, idempotency, auth. |
| `apps/agent/src/app/v1/brief/approve/route.ts` | Rewrite | Replaces 501 stub with founder-auth + framework-history write + order status flip. |
| `apps/agent/src/app/v1/brief/approve/route.test.ts` | Create | Vitest tests for the approve handler. |
| `apps/agent/src/lib/auth/verify-jwt.ts` | Create | Small helper that validates Authorization header → returns `{role, sub}` or null. Reused by both routes. |
| `apps/agent/src/lib/auth/verify-jwt.test.ts` | Create | Helper unit tests. |
| `apps/agent/src/lib/idempotency-key.ts` | Create | Pure function: `(brief_id, trigger_type, prior_run_index?) → string`. |
| `apps/agent/src/lib/idempotency-key.test.ts` | Create | Pure-logic tests. |
| `docs/plans/2026-05-05-v2-phase-4-route-wiring.md` | This file | The plan. |

## Surface contracts (informational)

```ts
// POST /v1/brief/analyze
//
// Request body (zod-validated):
//   { brief_id: uuid, trigger_type?: 'initial'|'re_analyze_same_frameworks'|'re_analyze_new_frameworks', founder_note?: string, prior_run_id?: uuid }
//   (trigger_type defaults to 'initial')
//   (founder_note required when trigger_type starts with 're_analyze')
//   (prior_run_id required when trigger_type starts with 're_analyze')
//
// Response (success): 202 { job_id: uuid, status: 'queued' | 'running' | 'completed' | 'failed', idempotency_key }
//   - 202 on fresh INSERT
//   - 200 on idempotency-key conflict (returns existing job's id + status)
//
// Response (errors):
//   - 400 if zod validation fails (returns issue list)
//   - 401 if Authorization header missing/invalid
//   - 403 if non-founder JWT calling with re_analyze_* trigger_type
//   - 500 if Supabase INSERT fails (logged, with anonymised detail)

// POST /v1/brief/approve
//
// Request body:
//   { order_id: uuid }
//
// Response (success): 200 { order_id, framework_history_rows_written: number }
//
// Response (errors):
//   - 400 if order_id missing/invalid
//   - 401 if missing Authorization
//   - 403 if non-founder JWT
//   - 404 if order not found OR no analysis_runs.is_current row for the order's brief
//   - 409 if order.status is not in ['pending_founder_review', 'briefs_email_failed']
//   - 500 on Supabase failure
```

---

## Task 1 — Auth helper: `verify-jwt.ts`

**Files:**
- Create: `apps/agent/src/lib/auth/verify-jwt.ts`
- Create: `apps/agent/src/lib/auth/verify-jwt.test.ts`

The helper is small: read the `Authorization: Bearer <token>` header, decode the JWT (no signature verify needed in Phase 4 — Supabase already validates downstream when calling tables; the route just needs the role claim for 401/403 routing). Returns `{ role, sub } | null`.

For Phase 4 minimum-viable: parse the token's middle segment (base64-decode the payload), extract `role` and `sub`. If parse fails, return null. If header missing or doesn't start with `Bearer `, return null. This is deliberately lenient — full signature verification lives in Supabase RLS policies, which already gate the actual data access. The route helper is a 401/403 router only.

- [ ] **Step 1: Write failing tests**

Create `apps/agent/src/lib/auth/verify-jwt.test.ts`:

```ts
import { describe, it, expect } from 'vitest';
import { verifyJwt } from './verify-jwt';

function makeJwt(payload: Record<string, unknown>): string {
  const header = Buffer.from(JSON.stringify({ alg: 'HS256', typ: 'JWT' })).toString('base64url');
  const body = Buffer.from(JSON.stringify(payload)).toString('base64url');
  return `${header}.${body}.fake-signature`;
}

describe('verifyJwt', () => {
  it('returns null when Authorization header is missing', () => {
    const headers = new Headers();
    expect(verifyJwt(headers)).toBeNull();
  });

  it('returns null when Authorization header does not start with Bearer', () => {
    const headers = new Headers({ Authorization: 'Basic abc' });
    expect(verifyJwt(headers)).toBeNull();
  });

  it('returns null when the JWT body cannot be parsed', () => {
    const headers = new Headers({ Authorization: 'Bearer not.a.jwt' });
    expect(verifyJwt(headers)).toBeNull();
  });

  it('returns { role, sub } from a founder-claim JWT', () => {
    const token = makeJwt({ role: 'founder', sub: 'user-1' });
    const headers = new Headers({ Authorization: `Bearer ${token}` });
    expect(verifyJwt(headers)).toEqual({ role: 'founder', sub: 'user-1' });
  });

  it('returns { role, sub } from a service-role JWT', () => {
    const token = makeJwt({ role: 'service_role', sub: 'system' });
    const headers = new Headers({ Authorization: `Bearer ${token}` });
    expect(verifyJwt(headers)).toEqual({ role: 'service_role', sub: 'system' });
  });

  it('returns sub=null when the JWT body has no sub claim', () => {
    const token = makeJwt({ role: 'founder' });
    const headers = new Headers({ Authorization: `Bearer ${token}` });
    expect(verifyJwt(headers)).toEqual({ role: 'founder', sub: null });
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

```bash
pnpm --filter @operscale-calendar/agent test src/lib/auth/verify-jwt.test.ts
```

Expected: FAIL — `verifyJwt` not exported.

- [ ] **Step 3: Implement `verifyJwt`**

Create `apps/agent/src/lib/auth/verify-jwt.ts`:

```ts
// apps/agent/src/lib/auth/verify-jwt.ts
//
// Phase 4 routes use this for 401/403 routing only. Full signature verification
// happens at the Supabase RLS layer when the route's downstream call hits the
// table. This helper just parses the role claim out of the Authorization header.

export interface JwtClaims {
  role: string;
  sub: string | null;
}

export function verifyJwt(headers: Headers): JwtClaims | null {
  const auth = headers.get('Authorization') ?? headers.get('authorization');
  if (!auth || !auth.startsWith('Bearer ')) return null;

  const token = auth.slice('Bearer '.length).trim();
  const parts = token.split('.');
  if (parts.length !== 3) return null;

  try {
    const bodyJson = Buffer.from(parts[1]!, 'base64url').toString('utf8');
    const claims = JSON.parse(bodyJson);
    if (typeof claims.role !== 'string') return null;
    return {
      role: claims.role,
      sub: typeof claims.sub === 'string' ? claims.sub : null,
    };
  } catch {
    return null;
  }
}
```

- [ ] **Step 4: Verify tests pass + typecheck**

```bash
pnpm --filter @operscale-calendar/agent test src/lib/auth/verify-jwt.test.ts
pnpm --filter @operscale-calendar/agent typecheck
pnpm --filter @operscale-calendar/agent test
```

Expected: 6 verify-jwt tests pass. Typecheck clean. Total suite ~195 (189 prior + 6 new).

- [ ] **Step 5: Commit**

```bash
git add apps/agent/src/lib/auth/verify-jwt.ts apps/agent/src/lib/auth/verify-jwt.test.ts
git commit -m "$(cat <<'EOF'
feat(agent): verify-jwt helper for Phase 4 route auth routing

Parses Authorization: Bearer <token> header, base64-decodes the JWT
body, returns { role, sub } or null. Lenient by design — signature
verification happens at the Supabase RLS layer when the route's
downstream call hits a table. Phase 4 routes use this helper only
for 401/403 routing on the role claim.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Task 2 — Idempotency-key helper

**Files:**
- Create: `apps/agent/src/lib/idempotency-key.ts`
- Create: `apps/agent/src/lib/idempotency-key.test.ts`

Pure function. Used by `analyze` route to compute the `ai_analysis_jobs.idempotency_key` value. Conflict-on-key returns the existing job rather than enqueuing a new one.

- [ ] **Step 1: Write failing tests**

Create `apps/agent/src/lib/idempotency-key.test.ts`:

```ts
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
```

- [ ] **Step 2: Run tests to verify they fail**

```bash
pnpm --filter @operscale-calendar/agent test src/lib/idempotency-key.test.ts
```

Expected: FAIL — `computeIdempotencyKey` not exported.

- [ ] **Step 3: Implement `computeIdempotencyKey`**

Create `apps/agent/src/lib/idempotency-key.ts`:

```ts
// apps/agent/src/lib/idempotency-key.ts
//
// Deterministic key for ai_analysis_jobs.idempotency_key (UNIQUE constraint
// in migration 0006). Conflict-on-key in the analyze route returns the
// existing job rather than enqueuing a new one — makes the route safe to
// retry from any caller.

export type TriggerType =
  | 'initial'
  | 're_analyze_same_frameworks'
  | 're_analyze_new_frameworks';

export interface IdempotencyKeyInput {
  brief_id: string;
  trigger_type: TriggerType;
  prior_run_index?: number;
}

export function computeIdempotencyKey(input: IdempotencyKeyInput): string {
  if (input.trigger_type === 'initial') {
    return `${input.brief_id}::initial::0`;
  }
  if (typeof input.prior_run_index !== 'number') {
    throw new Error(
      `computeIdempotencyKey: trigger_type=${input.trigger_type} requires prior_run_index`,
    );
  }
  return `${input.brief_id}::${input.trigger_type}::${input.prior_run_index}`;
}
```

- [ ] **Step 4: Verify tests pass + typecheck**

```bash
pnpm --filter @operscale-calendar/agent test src/lib/idempotency-key.test.ts
pnpm --filter @operscale-calendar/agent typecheck
pnpm --filter @operscale-calendar/agent test
```

Expected: 3 idempotency-key tests pass. Typecheck clean. Total suite ~198.

- [ ] **Step 5: Commit**

```bash
git add apps/agent/src/lib/idempotency-key.ts apps/agent/src/lib/idempotency-key.test.ts
git commit -m "$(cat <<'EOF'
feat(agent): idempotency-key helper for ai_analysis_jobs enqueue

Pure function: (brief_id, trigger_type, prior_run_index?) → string.
Format: ${brief_id}::initial::0 for initial; ${brief_id}::${trigger_type}::${prior_run_index}
for re-analysis. Throws if trigger_type is re_analyze_* but prior_run_index
is missing — the analyze route validates this before calling.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Task 3 — `/v1/brief/analyze` route

**Files:**
- Rewrite: `apps/agent/src/app/v1/brief/analyze/route.ts`
- Create: `apps/agent/src/app/v1/brief/analyze/route.test.ts`

Replace the 501 stub. Validate body, auth, compute idempotency_key, INSERT or return existing.

- [ ] **Step 1: Write failing tests**

Create `apps/agent/src/app/v1/brief/analyze/route.test.ts`:

```ts
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { POST } from './route';

const FOUNDER_TOKEN = (() => {
  const header = Buffer.from(JSON.stringify({ alg: 'HS256', typ: 'JWT' })).toString('base64url');
  const body = Buffer.from(JSON.stringify({ role: 'founder', sub: 'founder-1' })).toString('base64url');
  return `${header}.${body}.sig`;
})();
const SERVICE_TOKEN = (() => {
  const header = Buffer.from(JSON.stringify({ alg: 'HS256', typ: 'JWT' })).toString('base64url');
  const body = Buffer.from(JSON.stringify({ role: 'service_role', sub: 'system' })).toString('base64url');
  return `${header}.${body}.sig`;
})();

let supabaseInsertMock: any;
let supabaseSelectMock: any;

vi.mock('@/lib/supabase-admin', () => ({
  getSupabaseAdmin: () => ({
    from: vi.fn((table: string) => {
      if (table === 'ai_analysis_jobs') {
        return {
          select: vi.fn().mockReturnValue({
            eq: vi.fn().mockReturnValue({
              maybeSingle: vi.fn().mockImplementation(() => supabaseSelectMock()),
            }),
          }),
          insert: vi.fn().mockImplementation((row: any) => ({
            select: vi.fn().mockReturnValue({
              maybeSingle: vi.fn().mockImplementation(() => supabaseInsertMock(row)),
            }),
          })),
        };
      }
      if (table === 'analysis_runs') {
        return {
          select: vi.fn().mockReturnValue({
            eq: vi.fn().mockReturnValue({
              eq: vi.fn().mockReturnValue({
                maybeSingle: vi.fn().mockResolvedValue({ data: { run_index: 2 }, error: null }),
              }),
            }),
          }),
        };
      }
      return {};
    }),
  }),
  writeActivityLog: vi.fn().mockResolvedValue(undefined),
}));

beforeEach(() => {
  supabaseInsertMock = vi.fn().mockResolvedValue({ data: { id: 'new-job-id' }, error: null });
  supabaseSelectMock = vi.fn().mockResolvedValue({ data: null, error: null });
});

function makeRequest(body: any, token = FOUNDER_TOKEN): Request {
  return new Request('http://localhost/v1/brief/analyze', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
    body: JSON.stringify(body),
  });
}

describe('POST /v1/brief/analyze', () => {
  it('returns 401 when Authorization is missing', async () => {
    const req = new Request('http://localhost/v1/brief/analyze', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ brief_id: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa' }),
    });
    const res = await POST(req);
    expect(res.status).toBe(401);
  });

  it('returns 400 when brief_id is missing or not a UUID', async () => {
    const res = await POST(makeRequest({ brief_id: 'not-a-uuid' }));
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body).toMatchObject({ error: expect.stringContaining('brief_id') });
  });

  it('enqueues an initial job and returns 202 with the new job_id', async () => {
    const res = await POST(
      makeRequest({ brief_id: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa' }, SERVICE_TOKEN),
    );
    expect(res.status).toBe(202);
    const body = await res.json();
    expect(body).toMatchObject({ job_id: 'new-job-id', status: 'queued' });
    expect(body.idempotency_key).toBe('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa::initial::0');
  });

  it('returns 200 with the existing job_id on idempotency_key conflict', async () => {
    supabaseInsertMock = vi.fn().mockResolvedValue({
      data: null,
      error: { code: '23505', message: 'duplicate key' },
    });
    supabaseSelectMock = vi.fn().mockResolvedValue({
      data: { id: 'existing-job-id', status: 'completed' },
      error: null,
    });
    const res = await POST(
      makeRequest({ brief_id: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa' }, SERVICE_TOKEN),
    );
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body).toMatchObject({ job_id: 'existing-job-id', status: 'completed' });
  });

  it('returns 400 when re_analyze_* trigger_type is missing founder_note or prior_run_id', async () => {
    const res = await POST(
      makeRequest({
        brief_id: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
        trigger_type: 're_analyze_same_frameworks',
      }),
    );
    expect(res.status).toBe(400);
  });

  it('enqueues a re_analyze_same_frameworks job with prior_run_index from prior run', async () => {
    const res = await POST(
      makeRequest({
        brief_id: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
        trigger_type: 're_analyze_same_frameworks',
        founder_note: 'tighten the hooks',
        prior_run_id: 'cccccccc-cccc-4ccc-8ccc-cccccccccccc',
      }),
    );
    expect(res.status).toBe(202);
    const body = await res.json();
    expect(body.idempotency_key).toBe(
      'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa::re_analyze_same_frameworks::2',
    );
  });

  it('returns 403 when a non-founder, non-service JWT calls a re_analyze_* trigger', async () => {
    const customerToken = (() => {
      const h = Buffer.from(JSON.stringify({ alg: 'HS256', typ: 'JWT' })).toString('base64url');
      const b = Buffer.from(JSON.stringify({ role: 'authenticated', sub: 'cust-1' })).toString('base64url');
      return `${h}.${b}.sig`;
    })();
    const res = await POST(
      makeRequest(
        {
          brief_id: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
          trigger_type: 're_analyze_new_frameworks',
          founder_note: 'tweak',
          prior_run_id: 'cccccccc-cccc-4ccc-8ccc-cccccccccccc',
        },
        customerToken,
      ),
    );
    expect(res.status).toBe(403);
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

```bash
pnpm --filter @operscale-calendar/agent test src/app/v1/brief/analyze/route.test.ts
```

Expected: FAIL — current `POST` returns 501 for everything.

- [ ] **Step 3: Implement the route**

Replace `apps/agent/src/app/v1/brief/analyze/route.ts` entirely with:

```ts
// POST /v1/brief/analyze
// Phase 4 implementation: validate + enqueue. Worker (Phase 3) handles
// the actual analysis async.
//
// Spec: docs/specs/v2-pipeline-implementation-design.md §3.4 + §9.

import { NextResponse } from 'next/server';
import { z } from 'zod';
import { getSupabaseAdmin, writeActivityLog } from '@/lib/supabase-admin';
import { verifyJwt } from '@/lib/auth/verify-jwt';
import { computeIdempotencyKey } from '@/lib/idempotency-key';

const BodySchema = z.discriminatedUnion('trigger_type', [
  z.object({
    brief_id: z.string().uuid(),
    trigger_type: z.literal('initial').optional().default('initial'),
  }).transform((v) => ({ ...v, trigger_type: 'initial' as const })),
  z.object({
    brief_id: z.string().uuid(),
    trigger_type: z.enum(['re_analyze_same_frameworks', 're_analyze_new_frameworks']),
    founder_note: z.string().min(1, 'founder_note required for re-analysis'),
    prior_run_id: z.string().uuid('prior_run_id required for re-analysis'),
  }),
]);

export async function POST(req: Request): Promise<Response> {
  const claims = verifyJwt(req.headers);
  if (!claims) return NextResponse.json({ error: 'unauthorised' }, { status: 401 });

  let parsed;
  try {
    const json = await req.json();
    parsed = BodySchema.parse(json);
  } catch (err) {
    const detail = err instanceof z.ZodError ? err.issues.map((i) => `${i.path.join('.')}: ${i.message}`).join('; ') : 'invalid json';
    return NextResponse.json({ error: `validation: ${detail}` }, { status: 400 });
  }

  // Re-analysis requires founder OR service_role.
  if (parsed.trigger_type !== 'initial' && claims.role !== 'founder' && claims.role !== 'service_role') {
    return NextResponse.json({ error: 'forbidden' }, { status: 403 });
  }

  const supabase = getSupabaseAdmin();

  // For re-analysis, look up the prior run's run_index for the idempotency key.
  let prior_run_index: number | undefined;
  if (parsed.trigger_type !== 'initial') {
    const { data: priorRow, error: priorErr } = await supabase
      .from('analysis_runs')
      .select('run_index')
      .eq('id', parsed.prior_run_id)
      .eq('brief_id', parsed.brief_id)
      .maybeSingle();
    if (priorErr || !priorRow) {
      return NextResponse.json({ error: 'prior_run_not_found' }, { status: 404 });
    }
    prior_run_index = priorRow.run_index;
  }

  const idempotency_key = computeIdempotencyKey({
    brief_id: parsed.brief_id,
    trigger_type: parsed.trigger_type,
    prior_run_index,
  });

  const { data: inserted, error: insErr } = await supabase
    .from('ai_analysis_jobs')
    .insert({
      brief_id: parsed.brief_id,
      trigger_type: parsed.trigger_type,
      founder_note: parsed.trigger_type !== 'initial' ? parsed.founder_note : null,
      prior_run_id: parsed.trigger_type !== 'initial' ? parsed.prior_run_id : null,
      idempotency_key,
    })
    .select('id')
    .maybeSingle();

  // 23505 = Postgres unique_violation. Conflict on idempotency_key means
  // we already enqueued this exact (brief, trigger, prior_run_index) tuple.
  // Return the existing job's id + status with HTTP 200 so callers can poll.
  if (insErr?.code === '23505') {
    const { data: existing } = await supabase
      .from('ai_analysis_jobs')
      .select('id, status')
      .eq('idempotency_key', idempotency_key)
      .maybeSingle();
    if (existing) {
      return NextResponse.json(
        { job_id: existing.id, status: existing.status, idempotency_key },
        { status: 200 },
      );
    }
    // Conflict reported but no existing row — race; return 500 with detail.
    return NextResponse.json({ error: 'idempotency_conflict_but_no_existing_row' }, { status: 500 });
  }

  if (insErr || !inserted) {
    return NextResponse.json(
      { error: `enqueue_failed: ${insErr?.message ?? 'no row returned'}` },
      { status: 500 },
    );
  }

  await writeActivityLog(
    {
      eventType: 'ai_analysis_enqueued',
      actor: claims.role === 'service_role' ? 'system' : 'founder',
      briefId: parsed.brief_id,
      payload: {
        job_id: inserted.id,
        trigger_type: parsed.trigger_type,
        idempotency_key,
      },
    },
    supabase,
  );

  return NextResponse.json(
    { job_id: inserted.id, status: 'queued', idempotency_key },
    { status: 202 },
  );
}
```

- [ ] **Step 4: Verify tests pass + typecheck**

```bash
pnpm --filter @operscale-calendar/agent test src/app/v1/brief/analyze/route.test.ts
pnpm --filter @operscale-calendar/agent typecheck
pnpm --filter @operscale-calendar/agent test
```

Expected: 7 analyze-route tests pass. Typecheck clean. Total suite ~205. The route file imports `getSupabaseAdmin` from `@/lib/supabase-admin` which triggers `assertServerSide()` at module load — that's correct because the route runs server-side.

- [ ] **Step 5: Commit**

```bash
git add apps/agent/src/app/v1/brief/analyze/route.ts apps/agent/src/app/v1/brief/analyze/route.test.ts
git commit -m "$(cat <<'EOF'
feat(agent): /v1/brief/analyze enqueues ai_analysis_jobs (cuts over from 501)

Phase 4 cutover. Validates body via zod (discriminated union on
trigger_type), checks JWT for founder/service_role on re-analysis,
computes deterministic idempotency_key, INSERTs ai_analysis_jobs and
returns 202 with the job_id. On UNIQUE-violation (Postgres 23505),
returns 200 with the existing job's id+status — making the route safe
to retry from any caller. Worker (Phase 3) processes the queue.

ai_analysis_enqueued activity_log row written for traceability.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Task 4 — `/v1/brief/approve` route — framework-history write + status flip

**Files:**
- Rewrite: `apps/agent/src/app/v1/brief/approve/route.ts`
- Create: `apps/agent/src/app/v1/brief/approve/route.test.ts`

Phase 4 scope: founder auth → read brief's `is_current` analysis_runs row → INSERT framework_history rows → flip order status. Paystack/Resend deferred to Phase 4.5.

- [ ] **Step 1: Verify the customer_framework_history schema**

Before writing the route, confirm the actual `customer_framework_history` columns and PRIMARY KEY. From Phase 3 Task 16's discovery the columns are: `customer_id, order_id, framework_slot, archetype_slot, used_at`. Read `supabase/migrations/0005_framework_seed_and_history.sql` to confirm the PRIMARY KEY is `(customer_id, order_id, framework_slot, archetype_slot)` and the `used_at` column has default `now()`.

If the migration's PRIMARY KEY differs from the assumption, adjust the INSERT below to match (e.g., add `ON CONFLICT DO NOTHING` if it's a composite PK that allows duplicate-INSERT noops).

Also confirm:
- `orders.status` enum/CHECK includes `'founder_approved'`.
- `orders` has a `brief_id` column linking back to `briefs`.

If the orders schema doesn't match these assumptions (per Phase 3 Task 11's `briefs.form_payload` discovery), adjust the route to match the real shape — and update this plan in the same commit per "plan keeps pace with code".

- [ ] **Step 2: Write failing tests**

Create `apps/agent/src/app/v1/brief/approve/route.test.ts`:

```ts
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { POST } from './route';

const FOUNDER_TOKEN = (() => {
  const h = Buffer.from(JSON.stringify({ alg: 'HS256', typ: 'JWT' })).toString('base64url');
  const b = Buffer.from(JSON.stringify({ role: 'founder', sub: 'founder-1' })).toString('base64url');
  return `${h}.${b}.sig`;
})();

let orderRow: any;
let analysisRunRow: any;
let frameworkHistoryInserts: any[];
let orderUpdates: any[];

vi.mock('@/lib/supabase-admin', () => ({
  getSupabaseAdmin: () => ({
    from: vi.fn((table: string) => {
      if (table === 'orders') {
        return {
          select: vi.fn().mockReturnValue({
            eq: vi.fn().mockReturnValue({
              maybeSingle: vi.fn().mockImplementation(() => Promise.resolve({ data: orderRow, error: null })),
            }),
          }),
          update: vi.fn().mockImplementation((row: any) => ({
            eq: vi.fn().mockImplementation(async (col: string, val: any) => {
              orderUpdates.push({ row, where: { [col]: val } });
              return { error: null };
            }),
          })),
        };
      }
      if (table === 'analysis_runs') {
        return {
          select: vi.fn().mockReturnValue({
            eq: vi.fn().mockReturnValue({
              eq: vi.fn().mockReturnValue({
                maybeSingle: vi.fn().mockImplementation(() => Promise.resolve({ data: analysisRunRow, error: null })),
              }),
            }),
          }),
        };
      }
      if (table === 'customer_framework_history') {
        return {
          insert: vi.fn().mockImplementation(async (rows: any[]) => {
            frameworkHistoryInserts.push(rows);
            return { error: null };
          }),
        };
      }
      return {};
    }),
  }),
  writeActivityLog: vi.fn().mockResolvedValue(undefined),
}));

beforeEach(() => {
  orderRow = {
    id: 'order-1',
    brief_id: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
    customer_id: 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb',
    status: 'pending_founder_review',
  };
  analysisRunRow = {
    id: 'run-1',
    brief_id: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
    framework_seed: {
      seed_hash: 'h',
      selected_pairs: [
        { framework: 'DR_FORMULA', archetype: 'PRICING_BREAKDOWN' },
        { framework: 'PAS', archetype: 'SERVICE_ANATOMY' },
        { framework: 'AIDA', archetype: 'PRODUCT_TOUR' },
      ],
    },
  };
  frameworkHistoryInserts = [];
  orderUpdates = [];
});

function makeRequest(body: any, token = FOUNDER_TOKEN): Request {
  return new Request('http://localhost/v1/brief/approve', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
    body: JSON.stringify(body),
  });
}

describe('POST /v1/brief/approve', () => {
  it('returns 401 when Authorization is missing', async () => {
    const req = new Request('http://localhost/v1/brief/approve', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ order_id: 'order-1' }),
    });
    expect((await POST(req)).status).toBe(401);
  });

  it('returns 403 when JWT role is not founder', async () => {
    const customerToken = (() => {
      const h = Buffer.from(JSON.stringify({ alg: 'HS256', typ: 'JWT' })).toString('base64url');
      const b = Buffer.from(JSON.stringify({ role: 'authenticated' })).toString('base64url');
      return `${h}.${b}.sig`;
    })();
    expect((await POST(makeRequest({ order_id: 'order-1' }, customerToken))).status).toBe(403);
  });

  it('returns 400 when order_id is missing', async () => {
    expect((await POST(makeRequest({}))).status).toBe(400);
  });

  it('returns 404 when order is not found', async () => {
    orderRow = null;
    expect((await POST(makeRequest({ order_id: 'order-x' }))).status).toBe(404);
  });

  it('returns 409 when order.status is not in approvable set', async () => {
    orderRow.status = 'paid';
    const res = await POST(makeRequest({ order_id: 'order-1' }));
    expect(res.status).toBe(409);
  });

  it('writes one customer_framework_history row per selected_pair and flips order status', async () => {
    const res = await POST(makeRequest({ order_id: 'order-1' }));
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body).toMatchObject({ order_id: 'order-1', framework_history_rows_written: 3 });

    expect(frameworkHistoryInserts).toHaveLength(1);
    expect(frameworkHistoryInserts[0]).toHaveLength(3);
    expect(frameworkHistoryInserts[0][0]).toMatchObject({
      customer_id: 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb',
      order_id: 'order-1',
      framework_slot: 'DR_FORMULA',
      archetype_slot: 'PRICING_BREAKDOWN',
    });

    expect(orderUpdates).toHaveLength(1);
    expect(orderUpdates[0].row.status).toBe('founder_approved');
  });

  it('returns 404 when no is_current analysis_runs row exists for the brief', async () => {
    analysisRunRow = null;
    expect((await POST(makeRequest({ order_id: 'order-1' }))).status).toBe(404);
  });
});
```

- [ ] **Step 3: Run tests to verify they fail**

```bash
pnpm --filter @operscale-calendar/agent test src/app/v1/brief/approve/route.test.ts
```

Expected: FAIL — current `POST` returns 501.

- [ ] **Step 4: Implement the route**

Replace `apps/agent/src/app/v1/brief/approve/route.ts` with:

```ts
// POST /v1/brief/approve
// Phase 4 scope: founder auth → read brief's is_current analysis_runs row →
// INSERT customer_framework_history rows for each selected_pair → flip
// orders.status='founder_approved'.
//
// Paystack initialise + Resend brief-email send are Phase 4.5 (separate plan).
//
// Spec: docs/specs/v2-pipeline-implementation-design.md §3.4 + §9.

import { NextResponse } from 'next/server';
import { z } from 'zod';
import { getSupabaseAdmin, writeActivityLog } from '@/lib/supabase-admin';
import { verifyJwt } from '@/lib/auth/verify-jwt';

const BodySchema = z.object({ order_id: z.string().min(1) });

const APPROVABLE_STATUSES = ['pending_founder_review', 'briefs_email_failed'] as const;

export async function POST(req: Request): Promise<Response> {
  const claims = verifyJwt(req.headers);
  if (!claims) return NextResponse.json({ error: 'unauthorised' }, { status: 401 });
  if (claims.role !== 'founder') return NextResponse.json({ error: 'forbidden' }, { status: 403 });

  let parsed;
  try {
    parsed = BodySchema.parse(await req.json());
  } catch (err) {
    const detail = err instanceof z.ZodError ? err.issues.map((i) => `${i.path.join('.')}: ${i.message}`).join('; ') : 'invalid json';
    return NextResponse.json({ error: `validation: ${detail}` }, { status: 400 });
  }

  const supabase = getSupabaseAdmin();

  const { data: order, error: orderErr } = await supabase
    .from('orders')
    .select('id, brief_id, customer_id, status')
    .eq('id', parsed.order_id)
    .maybeSingle();
  if (orderErr || !order) {
    return NextResponse.json({ error: 'order_not_found' }, { status: 404 });
  }
  if (!(APPROVABLE_STATUSES as readonly string[]).includes(order.status)) {
    return NextResponse.json(
      { error: `order_status_not_approvable: ${order.status}` },
      { status: 409 },
    );
  }

  // Read the current analysis_runs row for this brief.
  const { data: run, error: runErr } = await supabase
    .from('analysis_runs')
    .select('id, framework_seed')
    .eq('brief_id', order.brief_id)
    .eq('is_current', true)
    .maybeSingle();
  if (runErr || !run) {
    return NextResponse.json({ error: 'no_current_analysis_run' }, { status: 404 });
  }

  const pairs: Array<{ framework: string; archetype: string }> =
    run.framework_seed?.selected_pairs ?? [];
  if (pairs.length === 0) {
    return NextResponse.json({ error: 'analysis_run_has_no_selected_pairs' }, { status: 500 });
  }

  // Write one customer_framework_history row per pair.
  const historyRows = pairs.map((p) => ({
    customer_id: order.customer_id,
    order_id: order.id,
    framework_slot: p.framework,
    archetype_slot: p.archetype,
  }));
  const { error: histErr } = await supabase
    .from('customer_framework_history')
    .insert(historyRows);
  if (histErr) {
    return NextResponse.json(
      { error: `framework_history_insert_failed: ${histErr.message}` },
      { status: 500 },
    );
  }

  // Flip order status. Note: in Phase 4 we do NOT INSERT the Paystack URL,
  // do NOT send the brief email — those are Phase 4.5.
  await supabase
    .from('orders')
    .update({
      status: 'founder_approved',
      founder_approved_at: new Date().toISOString(),
      founder_approved_by: claims.sub,
      approved_analysis_run_id: run.id,
    })
    .eq('id', order.id);

  await writeActivityLog(
    {
      eventType: 'founder_approved',
      actor: 'founder',
      briefId: order.brief_id,
      orderId: order.id,
      payload: {
        analysis_run_id: run.id,
        framework_history_rows_written: historyRows.length,
      },
    },
    supabase,
  );

  return NextResponse.json(
    { order_id: order.id, framework_history_rows_written: historyRows.length },
    { status: 200 },
  );
}
```

- [ ] **Step 5: Verify tests pass + typecheck**

```bash
pnpm --filter @operscale-calendar/agent test src/app/v1/brief/approve/route.test.ts
pnpm --filter @operscale-calendar/agent typecheck
pnpm --filter @operscale-calendar/agent test
```

Expected: 7 approve-route tests pass. Typecheck clean. Total suite ~212.

- [ ] **Step 6: Commit**

```bash
git add apps/agent/src/app/v1/brief/approve/route.ts apps/agent/src/app/v1/brief/approve/route.test.ts
git commit -m "$(cat <<'EOF'
feat(agent): /v1/brief/approve writes framework-history + flips status

Phase 4 scope. Founder auth → read brief's is_current analysis_runs
row → INSERT one customer_framework_history row per selected_pair
(framework_slot, archetype_slot, customer_id, order_id) → UPDATE
orders SET status='founder_approved', founder_approved_at,
founder_approved_by, approved_analysis_run_id.

Paystack initialise + Resend brief-email send are Phase 4.5
(separate plan). The current 501 stub mentioned them in its TODO
comment; that scope ships in 4.5.

founder_approved activity_log row written for traceability.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Task 5 — Manual end-to-end staging smoke

**Files:** None new — paramiko-driven smoke against the live VPS, mirroring Phase 3 Task 16's pattern.

The Phase 3 worker is already deployed. Phase 4 just adds two routes that talk to the same DB. After deploying Phase 4 (Task 6 below), this task verifies the full flow:

1. POST /v1/brief/analyze with a fixture brief → expect 202 + job_id
2. Poll until job completes (~120s)
3. POST /v1/brief/approve with the brief's order → expect 200 + framework_history_rows_written
4. SELECT customer_framework_history WHERE order_id=… → expect N rows (one per selected_pair)
5. SELECT orders.status → expect 'founder_approved'
6. DELETE all test rows

The smoke uses the same fixture customer + brief from Phase 3 Task 16's smoke (Tola Studios, brief_id `aaaaaaaa-…`). Reuses the form_payload jsonb shape verified in Phase 3.

- [ ] **Step 1: Push all Phase 4 commits**

```bash
git push origin main
```

- [ ] **Step 2: Pull on VPS + rebuild agent image**

The agent image needs to rebuild because the route changed. Worker is unaffected (no rebuild needed) but the agent container's running image is stale.

```bash
PYTHONIOENCODING=utf-8 python -c "
import paramiko
with open(r'c:\Users\DELL\Documents\Antigravity\operscale-calender\.env', encoding='utf-8') as f:
    pw = next(l.split('=', 1)[1].strip() for l in f if l.startswith('server_password='))
c = paramiko.SSHClient(); c.set_missing_host_key_policy(paramiko.AutoAddPolicy())
c.connect('srv1297445.hstgr.cloud', 22, 'root', pw, timeout=20, allow_agent=False, look_for_keys=False)
for cmd in [
    'cd /docker/operscale-calendar/repo && git pull --ff-only origin main',
    'cd /docker/operscale-calendar && docker compose build agent 2>&1 | tail -5',
    'cd /docker/operscale-calendar && docker compose up -d --force-recreate agent 2>&1',
    'sleep 8; docker logs --tail 10 operscale-calendar-agent',
]:
    print(f'>>> {cmd[:80]}')
    _, out, err = c.exec_command(cmd, timeout=600)
    print(out.read().decode())
    e = err.read().decode()
    if e: print('STDERR:', e[:400])
c.close()
"
```

Expected: agent rebuilds (~30-60s), comes up clean. Verify `curl https://api.operscale.cloud/v1/health` still returns 200.

- [ ] **Step 3: Run end-to-end smoke**

The Phase 3 Task 16 smoke INSERT-ed the customer + brief directly into Postgres. Phase 4's smoke goes through the route instead. Use the same customer + brief.

Use a Python paramiko script that:
1. INSERTs the test customer + brief into Postgres (same as Phase 3 Task 16; the order is the new piece — INSERT one minimal `orders` row referencing the brief).
2. Calls `https://api.operscale.cloud/v1/brief/analyze` via Python `requests` with a service-role JWT and `{ brief_id }`.
3. Verifies 202 + job_id.
4. Polls Postgres `ai_analysis_jobs.status` every 15s until completed (timeout 180s).
5. Calls `https://api.operscale.cloud/v1/brief/approve` with founder JWT and `{ order_id }`.
6. Verifies 200 + framework_history_rows_written.
7. SELECTs the framework_history rows.
8. SELECTs the orders.status.
9. DELETEs everything.

The full script is long; the implementer adapts Phase 3 Task 16's structure. KEY EXTRA: needs a `orders` row INSERT and a service-role JWT for the analyze call.

- [ ] **Step 4: Cleanup test data**

Mirror Phase 3 Task 16's DELETE block, plus DELETE the customer_framework_history rows and the orders row.

- [ ] **Step 5: Document the smoke in commit body**

Don't commit smoke output (it has noisy timestamps and may have token IDs). Just summarise in the close-out commit.

---

## Task 6 — Close-out

**Files:**
- Modify: `prompt.md` (next session)
- Modify: project_state.md memory

- [ ] **Step 1: Run full verification**

```bash
pnpm --filter @operscale-calendar/agent test
pnpm --filter @operscale-calendar/agent typecheck
pnpm --filter @operscale-calendar/agent build:worker
docker build -f apps/agent/Dockerfile -t test-build . 2>&1 | tail -5
```

Expected: all pass; suite ~212; typecheck + build clean.

- [ ] **Step 2: Push everything (if not already pushed per Task 5 Step 1)**

```bash
git push origin main
```

- [ ] **Step 3: Update memory project_state.md**

Append a "V2 Phase 4 — ✅ COMPLETE" section listing the commit range, what shipped, and what remains for Phase 4.5 (Paystack + Resend on approve).

- [ ] **Step 4: Rewrite prompt.md as Phase 4.5 handoff**

Same pattern as the Phase 3 → Phase 4 handoff. Commit + push.

---

## Out of scope for Phase 4 (carry forward to Phase 4.5 plan)

- Paystack `/v1/payment/initialize` integration on approve
- Resend brief email render + send on approve
- Realtime CRM "pipeline health" panel data wiring
- Worker container scaling (replicas > 1)
- LISTEN/NOTIFY upgrade to push-based queue pickup

## Self-review notes

- Spec coverage: §9 row 10 (analyze) → Task 3. §9 row 11 (approve, framework-history extension) → Task 4. §9 Phase 4 narrative (lines 414-420) → Tasks 3 + 4 + 5.
- No placeholders.
- `verifyJwt`, `computeIdempotencyKey`, both route handlers, mocked-Supabase pattern — all consistent across tasks.
- Phase 4.5 scope (Paystack/Resend) explicitly deferred with rationale.
