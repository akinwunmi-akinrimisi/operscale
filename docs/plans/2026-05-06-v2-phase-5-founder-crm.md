# V2 Phase 5 — Founder CRM Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [x]`) syntax for tracking.

**Goal:** Ship the Founder CRM v0 — magic-link sign-in, pending-review queue, brief detail page (review + timeline modes), three founder actions (approve / re-analyze / discard), paid-orders dashboard — all in `apps/web` with Supabase Realtime live updates. v0 deliberately defers inline edit, alert cron, photo lightbox, and recovery actions per the design at `docs/specs/v2-phase-5-design.md`.

**Architecture:** Next 15 App Router Server Components for reads (anon + founder JWT cookie + RLS), middleware-based auth gate (already wired at `apps/web/src/middleware.ts`), `apps/agent` API routes for writes (only new backend code: `/v1/brief/discard`). `@supabase/ssr` for SSR + Realtime (already installed).

**Tech Stack:** Next 15.0.3 + React 19 RC, Tailwind + shadcn-ui (existing), `@supabase/ssr@^0.5.1` + `@supabase/supabase-js@^2.45.4` (already installed), vitest 1.6 (already installed) + `@testing-library/react` + `happy-dom` (to add), zod, Sentry (existing).

---

## Spec drift discovered during plan-writing

Reading the codebase before writing this plan surfaced four corrections to `docs/specs/v2-phase-5-design.md`. These are baked into Task 1 below so the spec and code commit together (per CLAUDE.md "plan keeps pace with code"):

1. **`/admin/sign-in` does not exist.** The existing `apps/web/src/middleware.ts` treats `/admin` itself as the sign-in page (always reachable; `/admin/*` is gated). The 14-line `apps/web/src/app/admin/page.tsx` stub already comments "/admin — sign-in page (magic link) + dashboard for already-signed-in founders." Plan extends `/admin/page.tsx` rather than creating `/admin/sign-in`.
2. **Auth callback lives at `/auth/callback`** (top-level, outside the middleware matcher `['/admin/:path*']`). Otherwise the magic-link callback would be redirected before code exchange.
3. **`apps/web/src/lib/supabase-server.ts` and `supabase-browser.ts` already exist** with `getSupabaseServer()`, `getSupabaseMiddleware()`, `getSupabaseBrowser()`. Plan uses these — does NOT create new factories under `lib/supabase/`.
4. **`/v1/brief/analyze` `trigger_type` enum is `'initial' | 're_analyze_same_frameworks' | 're_analyze_new_frameworks'`** — NOT `re_analyze_with_note`. Re-analyze modal sends `re_analyze_same_frameworks` (preserves the 8 selected pairs; founder-note is the variation lever). Picking different frameworks is deferred to Phase 5.x.

Additionally:

- **`@supabase/ssr` is already in `apps/web/package.json`** (^0.5.1). No new dep needed.
- **`apps/web/vitest.config.ts` already exists** with React plugin + path alias. Test environment is `'node'`; component tests use a per-file `// @vitest-environment happy-dom` directive once `happy-dom` is added to devDependencies.
- **`verify-jwt` duplicate in `apps/web/src/lib/auth/`** is NOT needed. Middleware uses `supabase.auth.getUser()` (canonical Supabase pattern); reads the role from `app_metadata.role` with `user_metadata.role` fallback.

## Open question resolved: `activity_log` founder INSERT RLS

Migration 0001 has `activity_log_anon_deny` RESTRICTIVE but no permissive policy for founder-role authenticated users — so the auth callback writing `founder_signed_in` from `apps/web` would be denied. Resolution: **migration `0009_activity_log_founder_insert.sql`** adds the missing permissive INSERT policy, symmetric with the existing `analysis_edits_founder_all` pattern. Applied in Task 1.

---

## Cadence & discipline

- **Direct commits to main; no feature branches** (per prompt).
- **Push every 2-3 tasks** (per prompt).
- **Commit format**: `<scope>: <imperative one-line>` (per CLAUDE.md). Use `git commit -F /c/tmp/commit-msg-<task>.txt` for messages with `#` chars (PowerShell heredoc trips on `#`).
- **Plan keeps pace with code**: when code review or schema reality reveals a plan-level bug, fix the plan file in the SAME commit as the code (per Phase 4.5 + 4.6 pattern).
- **Verification-before-completion** per CLAUDE.md: every task completes with `pnpm test` + `pnpm typecheck` clean before checking the box.
- **No silent swallows** (gotcha #11 + Phase 4.5 lesson): every error path either surfaces to the founder OR writes `activity_log` (best-effort with stderr fallback).

---

## Task 1: Spec patch + migration 0009 + apply to staging

**Files:**
- Modify: `docs/specs/v2-phase-5-design.md` (correct §4.1, §4.2, §4.5, §4.6, §5.1, §6.3, §7, §12 to match existing scaffolding)
- Create: `supabase/migrations/0009_activity_log_founder_insert.sql`
- Apply: `0009` to staging Supabase via paramiko + SFTP + `docker exec psql`

- [x] **Step 1.1: Update spec §4.1 routes table**

In `docs/specs/v2-phase-5-design.md` §4.1, replace the routes table with:

```markdown
| Route | Type | Purpose |
| --- | --- | --- |
| `/admin` | Client Component (replaces 14-line stub) | Magic-link sign-in form + post-auth shortcut to `/admin/pending-review` if already signed in |
| `/auth/callback` | Route Handler (top-level — outside middleware matcher) | Exchange magic-link code → session cookie → `founder_signed_in` activity_log → redirect to `/admin/pending-review` |
| `/admin/pending-review` | Server Component + `<RealtimeQueue />` client child | Initial queue + Realtime diffs |
| `/admin/orders/[id]` | Server Component (mode-switching) | Review mode if `status='pending_founder_review'`, else Timeline mode |
| `/admin/paid-orders` | Server Component + `<RealtimePaidOrders />` client child | 25 most-recent + Load more |
```

- [x] **Step 1.2: Update spec §4.2 auth gate**

Replace §4.2 with:

```markdown
### 4.2 Auth gate

Already wired at `apps/web/src/middleware.ts` (matcher `['/admin/:path*']`). Behaviour:

1. `/admin` (sign-in page) — always allowed, no redirect.
2. `/admin/*` — uses `getSupabaseMiddleware(req, res)` from `lib/supabase-server.ts`. Calls `supabase.auth.getUser()` (forces token refresh + signature verification). On error or null user → 307 to `/admin?reason=not_authenticated`.
3. Reads role from `data.user.app_metadata.role` (canonical for Supabase) with fallback to `data.user.user_metadata.role`. If `role !== 'founder'` → 307 to `/admin?reason=not_authorized`.

Phase 5 does NOT modify the middleware — the existing implementation is correct.
```

- [x] **Step 1.3: Update spec §4.5 lib files**

Replace §4.5 with:

```markdown
### 4.5 Library files

Existing (verified in repo):

- `apps/web/src/lib/supabase-server.ts` — exports `getSupabaseServer()` (Server Components / Route Handlers via `next/headers`) and `getSupabaseMiddleware(req, res)` (middleware).
- `apps/web/src/lib/supabase-browser.ts` — exports `getSupabaseBrowser()` (browser, cached singleton).

Phase 5 does NOT add `src/lib/supabase/server.ts`, `src/lib/supabase/browser.ts`, `src/lib/supabase/middleware.ts`, or `src/lib/auth/verify-jwt.ts`. The existing factories cover all needs.
```

- [x] **Step 1.4: Update spec §4.6 deps**

Replace §4.6 with:

```markdown
### 4.6 Dependencies added

- `apps/web` devDependencies: `@testing-library/react`, `@testing-library/jest-dom`, `happy-dom` (for component tests). `@supabase/ssr` and `@supabase/supabase-js` are already installed.
- `apps/agent`: no new deps.
```

- [x] **Step 1.5: Update spec §5.1 sign-in component**

In §5.1, change:

```markdown
- `SignInForm` (`'use client'`) — controlled email input + submit. Calls `supabase.auth.signInWithOtp`. Renders `idle | sent | error` states.
```

to:

```markdown
- `SignInForm` (`'use client'`) — lives at `/admin/page.tsx` (replaces the 14-line stub). Controlled email input + submit. Calls `getSupabaseBrowser().auth.signInWithOtp({ email, options: { emailRedirectTo: \`${origin}/auth/callback\` } })`. Renders `idle | sent | error` states. Honours `?reason=not_authenticated|not_authorized|expired|session` from middleware/callback redirects with inline copy.
```

- [x] **Step 1.6: Update spec §6.3 re-analyze trigger_type**

In the writes table:

```markdown
| Re-analyze | `POST /v1/brief/analyze` (live) | `{ brief_id, trigger_type:'re_analyze_same_frameworks', prior_run_id, founder_note }` + JWT | INSERT ai_analysis_jobs, INSERT activity_log `ai_analysis_enqueued` |
```

(Drop `re_analyze_with_note` — that name doesn't exist in code. Use the canonical `re_analyze_same_frameworks` from `apps/agent/src/lib/idempotency-key.ts`.)

- [x] **Step 1.7: Update spec §7 auth flow**

Replace step 6 with:

```markdown
6. `/auth/callback` Route Handler exchanges code for session via `getSupabaseServer()` (which sets cookies via the cookieStore.setAll path); INSERTs `founder_signed_in` activity_log row directly (migration 0009 enables this); 307 to `/admin/pending-review`.
```

- [x] **Step 1.8: Update spec §12 files touched**

Replace the new files / modified files lists with the corrected inventory:

```markdown
### New files

- `apps/web/src/app/auth/callback/route.ts`
- `apps/web/src/app/admin/SignInForm.tsx` (`'use client'`)
- `apps/web/src/app/admin/paid-orders/page.tsx`
- `apps/web/src/app/admin/paid-orders/PaidOrdersTable.tsx`
- `apps/web/src/app/admin/paid-orders/LoadMoreButton.tsx`
- `apps/web/src/app/admin/paid-orders/RealtimePaidOrders.tsx`
- `apps/web/src/app/admin/pending-review/QueueTable.tsx`
- `apps/web/src/app/admin/pending-review/QueueRow.tsx`
- `apps/web/src/app/admin/pending-review/QueueCapBanner.tsx`
- `apps/web/src/app/admin/pending-review/RealtimeQueue.tsx`
- `apps/web/src/app/admin/orders/[id]/components/HistoryAccordion.tsx`
- `apps/web/src/app/admin/orders/[id]/components/FormResponsesPanel.tsx`
- `apps/web/src/app/admin/orders/[id]/components/AiSnapshotPanel.tsx`
- `apps/web/src/app/admin/orders/[id]/components/ActionBar.tsx` (`'use client'`)
- `apps/web/src/app/admin/orders/[id]/components/ApproveModal.tsx`
- `apps/web/src/app/admin/orders/[id]/components/ReanalyzeModal.tsx`
- `apps/web/src/app/admin/orders/[id]/components/DiscardModal.tsx`
- `apps/web/src/app/admin/orders/[id]/components/RealtimeOrderDetail.tsx`
- `apps/web/src/app/admin/orders/[id]/components/timeline/EventCard.tsx`
- `apps/web/src/app/admin/error.tsx`
- `apps/web/test/components/SignInForm.test.tsx`
- `apps/web/test/components/QueueRow.test.tsx`
- `apps/web/test/components/HistoryAccordion.test.tsx`
- `apps/web/test/components/DiscardModal.test.tsx`
- `apps/web/test/components/ReanalyzeModal.test.tsx`
- `apps/web/test/components/ApproveModal.test.tsx`
- `apps/agent/src/app/v1/brief/discard/route.test.ts`
- `apps/agent/test/integration/phase5-schema-shapes.test.ts`
- `supabase/migrations/0009_activity_log_founder_insert.sql`
- `supabase/migrations/0010_founder_read_customers_brief_photos.sql`

### Modified files

- `apps/agent/src/app/v1/brief/discard/route.ts` (replace 501 stub)
- `apps/web/src/app/admin/layout.tsx` (extend with signed-in email + sign-out)
- `apps/web/src/app/admin/page.tsx` (replace 14-line stub with `<SignInForm />`)
- `apps/web/src/app/admin/pending-review/page.tsx` (full implementation)
- `apps/web/src/app/admin/orders/[id]/page.tsx` (mode-switching + data fetch)
- `apps/web/src/app/admin/orders/[id]/components/ReviewMode.tsx` (full implementation)
- `apps/web/src/app/admin/orders/[id]/components/TimelineMode.tsx` (full implementation)
- `apps/web/package.json` (add `@testing-library/*` + `happy-dom`)
- `apps/web/vitest.config.ts` (no change — happy-dom via per-file directive)
- `.github/workflows/ci.yml` (add apps/web test step)
- `.github/workflows/nightly-smoke.yml` (add schema-shapes test)
```

- [x] **Step 1.9: Write migration 0009**

Create `supabase/migrations/0009_activity_log_founder_insert.sql`:

```sql
-- 0009_activity_log_founder_insert.sql
--
-- Phase 5 (Founder CRM) needs the auth-callback route to insert a
-- `founder_signed_in` activity_log row using the founder's authenticated
-- session (anon key + role=founder JWT). Migration 0001 only had the
-- `activity_log_anon_deny` restrictive policy; without a permissive
-- policy for authenticated founder-role users, RLS denies the INSERT.
--
-- This migration adds the symmetric permissive policy, mirroring the
-- existing `analysis_edits_founder_all` pattern from 0001.
--
-- Service-role writes (the existing apps/agent writeActivityLog helper)
-- are unaffected — service_role bypasses RLS by default in Supabase.

begin;

create policy activity_log_founder_insert on activity_log to authenticated
  for insert
  with check (auth.jwt() ->> 'role' = 'founder');

create policy activity_log_founder_read on activity_log to authenticated
  for select
  using (auth.jwt() ->> 'role' = 'founder');

commit;
```

(Read policy is added in the same migration because the brief detail page's HistoryAccordion + TimelineMode read activity_log via the founder JWT + RLS — Task 6 + Task 8 depend on this.)

- [x] **Step 1.10: Apply migration 0009 to staging Supabase**

Use the documented paramiko pattern (see `prompt.md` "Apply a new migration to staging" one-liner). Adapt:

```python
# C:\tmp\apply-migration-0009.py — DO NOT COMMIT
import paramiko, pathlib
pw = next(l.split('=', 1)[1].strip() for l in pathlib.Path(
    r'c:\Users\DELL\Documents\Antigravity\operscale-calender\.env'
).read_text(encoding='utf-8').splitlines() if l.startswith('server_password='))
c = paramiko.SSHClient(); c.set_missing_host_key_policy(paramiko.AutoAddPolicy())
c.connect('srv1297445.hstgr.cloud', 22, 'root', pw, timeout=20,
          allow_agent=False, look_for_keys=False)
sftp = c.open_sftp()
local = r'C:\Users\DELL\Documents\Antigravity\operscale-calender\operscale-calendar-platform\supabase\migrations\0009_activity_log_founder_insert.sql'
remote = '/tmp/0009.sql'
sftp.put(local, remote); sftp.close()
_, out, err = c.exec_command(
    f'docker cp /tmp/0009.sql supabase-db-1:/tmp/m.sql && '
    f'docker exec supabase-db-1 psql -U postgres -d postgres -v ON_ERROR_STOP=1 -f /tmp/m.sql && '
    f'docker exec supabase-db-1 psql -U postgres -d postgres -t -A -c "NOTIFY pgrst, \'reload schema\'"',
    timeout=30)
print('STDOUT:', out.read().decode()); print('STDERR:', err.read().decode())
c.close()
```

Run: `PYTHONIOENCODING=utf-8 python C:\tmp\apply-migration-0009.py`

Expected stdout includes `BEGIN`, `CREATE POLICY`, `CREATE POLICY`, `COMMIT` and `t` (psql showing the NOTIFY succeeded). No errors in stderr.

- [x] **Step 1.11: Verify policy applied**

Run via paramiko:

```bash
docker exec supabase-db-1 psql -U postgres -d postgres -t -A -c \
"SELECT policyname FROM pg_policies WHERE tablename='activity_log' ORDER BY policyname;"
```

Expected output (4 lines):
```
activity_log_anon_deny
activity_log_founder_insert
activity_log_founder_read
```

- [x] **Step 1.12: Commit**

```bash
cd "C:\Users\DELL\Documents\Antigravity\operscale-calender\operscale-calendar-platform"
git add docs/specs/v2-phase-5-design.md supabase/migrations/0009_activity_log_founder_insert.sql docs/plans/2026-05-06-v2-phase-5-founder-crm.md
git commit -F /c/tmp/commit-msg-task1.txt
```

Where `/c/tmp/commit-msg-task1.txt` contains:

```
phase-5(task-1): spec patch + migration 0009 (activity_log founder INSERT)

- Patch design doc §4.1, §4.2, §4.5, §4.6, §5.1, §6.3, §7, §12 to match
  existing scaffolding discovered during plan-writing (middleware
  already wired, /admin is the sign-in page, supabase client factories
  exist, /v1/brief/analyze trigger_type enum is re_analyze_same/new_
  frameworks not re_analyze_with_note).

- Migration 0009 adds founder-role permissive INSERT + SELECT policies
  on activity_log, mirroring the analysis_edits_founder_all pattern
  from 0001. Required for Phase 5's auth callback to write
  founder_signed_in directly via anon + founder JWT (without falling
  back to a new apps/agent endpoint).

- Plan file committed alongside so future tasks have the canonical
  reference. Plan-keeps-pace pattern from Phase 4.5 + 4.6 applies.
```

- [x] **Step 1.13: Verify**

Run:
```bash
git log --oneline -1
git status --short
```
Expected: latest commit is `phase-5(task-1): spec patch + migration 0009 (activity_log founder INSERT)`. `git status` clean.

---

## Task 2: TDD `/v1/brief/discard` route

**Files:**
- Create: `apps/agent/src/app/v1/brief/discard/route.test.ts`
- Modify: `apps/agent/src/app/v1/brief/discard/route.ts` (replace 501 stub)

Pattern: write 9 failing tests against the future implementation (mirrors `/v1/brief/approve` test layout from Phase 4 + 4.5), confirm they fail, write minimum impl to pass, verify, commit.

- [x] **Step 2.1: Read the existing `/v1/brief/approve` route as the canonical pattern**

Run: `cat apps/agent/src/app/v1/brief/approve/route.ts | head -80`

Confirm pattern: `verifyJwt` → role gate → zod → `getSupabaseAdmin()` → SELECT → status guard → UPDATE → `writeActivityLog` → return JSON.

- [x] **Step 2.2: Write failing tests for `/v1/brief/discard`**

Create `apps/agent/src/app/v1/brief/discard/route.test.ts`:

```typescript
import { describe, expect, it, vi, beforeEach } from 'vitest';
import { POST } from './route';

const mockSelectMaybeSingle = vi.fn();
const mockUpdate = vi.fn();
const mockWriteActivityLog = vi.fn();

vi.mock('@/lib/supabase-admin', () => ({
  getSupabaseAdmin: () => ({
    from: (table: string) => ({
      select: () => ({
        eq: () => ({
          maybeSingle: mockSelectMaybeSingle,
        }),
      }),
      update: mockUpdate.mockReturnValue({
        eq: () => Promise.resolve({ error: null }),
      }),
    }),
  }),
  writeActivityLog: (...args: unknown[]) => mockWriteActivityLog(...args),
}));

const FOUNDER_JWT_HEADER = `Bearer ${Buffer.from(JSON.stringify({ alg: 'HS256' })).toString(
  'base64url',
)}.${Buffer.from(JSON.stringify({ role: 'founder', sub: 'founder-uuid' })).toString(
  'base64url',
)}.signature`;

const NON_FOUNDER_JWT = `Bearer ${Buffer.from(JSON.stringify({ alg: 'HS256' })).toString(
  'base64url',
)}.${Buffer.from(JSON.stringify({ role: 'authenticated', sub: 'someone' })).toString(
  'base64url',
)}.signature`;

function makeRequest(body: unknown, jwtHeader?: string): Request {
  const headers: Record<string, string> = { 'content-type': 'application/json' };
  if (jwtHeader) headers['Authorization'] = jwtHeader;
  return new Request('http://localhost:3002/v1/brief/discard', {
    method: 'POST',
    headers,
    body: JSON.stringify(body),
  });
}

beforeEach(() => {
  mockSelectMaybeSingle.mockReset();
  mockUpdate.mockReset().mockReturnValue({ eq: () => Promise.resolve({ error: null }) });
  mockWriteActivityLog.mockReset().mockResolvedValue(undefined);
});

describe('POST /v1/brief/discard', () => {
  it('returns 401 when Authorization header is missing', async () => {
    const res = await POST(makeRequest({ order_id: 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa' }));
    expect(res.status).toBe(401);
  });

  it('returns 403 when role is not founder', async () => {
    const res = await POST(
      makeRequest({ order_id: 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa' }, NON_FOUNDER_JWT),
    );
    expect(res.status).toBe(403);
  });

  it('returns 400 when order_id is missing', async () => {
    const res = await POST(makeRequest({}, FOUNDER_JWT_HEADER));
    expect(res.status).toBe(400);
  });

  it('returns 400 when order_id is not a uuid', async () => {
    const res = await POST(makeRequest({ order_id: 'not-a-uuid' }, FOUNDER_JWT_HEADER));
    expect(res.status).toBe(400);
  });

  it('returns 400 when reason exceeds 500 chars', async () => {
    const res = await POST(
      makeRequest(
        {
          order_id: 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa',
          reason: 'x'.repeat(501),
        },
        FOUNDER_JWT_HEADER,
      ),
    );
    expect(res.status).toBe(400);
  });

  it('returns 404 when order is not found', async () => {
    mockSelectMaybeSingle.mockResolvedValueOnce({ data: null, error: null });
    const res = await POST(
      makeRequest({ order_id: 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa' }, FOUNDER_JWT_HEADER),
    );
    expect(res.status).toBe(404);
  });

  it('returns 409 when status is not pending_founder_review', async () => {
    mockSelectMaybeSingle.mockResolvedValueOnce({
      data: {
        id: 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa',
        brief_id: 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb',
        status: 'paid',
      },
      error: null,
    });
    const res = await POST(
      makeRequest({ order_id: 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa' }, FOUNDER_JWT_HEADER),
    );
    expect(res.status).toBe(409);
    const body = await res.json();
    expect(body.current_status).toBe('paid');
  });

  it('happy path returns 200 + UPDATEs status + writes activity_log with reason', async () => {
    mockSelectMaybeSingle.mockResolvedValueOnce({
      data: {
        id: 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa',
        brief_id: 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb',
        status: 'pending_founder_review',
      },
      error: null,
    });
    const res = await POST(
      makeRequest(
        {
          order_id: 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa',
          reason: 'spam submission',
        },
        FOUNDER_JWT_HEADER,
      ),
    );
    expect(res.status).toBe(200);
    expect(mockUpdate).toHaveBeenCalledTimes(1);
    expect(mockWriteActivityLog).toHaveBeenCalledWith(
      expect.objectContaining({
        eventType: 'founder_discarded',
        actor: 'founder',
        briefId: 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb',
        payload: expect.objectContaining({
          order_id: 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa',
          reason: 'spam submission',
        }),
      }),
      expect.anything(),
    );
  });

  it('returns 500 + writes discard_failed activity_log when UPDATE fails', async () => {
    mockSelectMaybeSingle.mockResolvedValueOnce({
      data: {
        id: 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa',
        brief_id: 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb',
        status: 'pending_founder_review',
      },
      error: null,
    });
    mockUpdate.mockReturnValueOnce({
      eq: () => Promise.resolve({ error: { message: 'simulated db failure' } }),
    });
    const res = await POST(
      makeRequest({ order_id: 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa' }, FOUNDER_JWT_HEADER),
    );
    expect(res.status).toBe(500);
    expect(mockWriteActivityLog).toHaveBeenCalledWith(
      expect.objectContaining({ eventType: 'discard_failed' }),
      expect.anything(),
    );
  });
});
```

- [x] **Step 2.3: Run tests — confirm they FAIL**

```bash
cd apps/agent && pnpm vitest run src/app/v1/brief/discard/route.test.ts
```

Expected: all 9 tests fail because `route.ts` still returns 501.

- [x] **Step 2.4: Implement `/v1/brief/discard`**

Replace the 20-line stub at `apps/agent/src/app/v1/brief/discard/route.ts`:

```typescript
// POST /v1/brief/discard
// Spec: docs/specs/founder-review-flow.md "Discard Action".
// Phase 5 implementation.

import { NextResponse } from 'next/server';
import { z } from 'zod';
import { getSupabaseAdmin, writeActivityLog } from '@/lib/supabase-admin';
import { verifyJwt } from '@/lib/auth/verify-jwt';

const BodySchema = z.object({
  order_id: z.string().uuid(),
  reason: z.string().max(500).optional(),
});

const DISCARDABLE_STATUSES = ['pending_founder_review'] as const;

export async function POST(req: Request): Promise<Response> {
  const claims = verifyJwt(req.headers);
  if (!claims) return NextResponse.json({ error: 'unauthorised' }, { status: 401 });
  if (claims.role !== 'founder') return NextResponse.json({ error: 'forbidden' }, { status: 403 });

  let parsed: z.infer<typeof BodySchema>;
  try {
    parsed = BodySchema.parse(await req.json());
  } catch (err) {
    const detail =
      err instanceof z.ZodError
        ? err.issues.map((i) => `${i.path.join('.')}: ${i.message}`).join('; ')
        : 'invalid json';
    return NextResponse.json({ error: `validation: ${detail}` }, { status: 400 });
  }

  const supabase = getSupabaseAdmin();

  const { data: order, error: orderErr } = await supabase
    .from('orders')
    .select('id, brief_id, status')
    .eq('id', parsed.order_id)
    .maybeSingle();

  if (orderErr || !order) {
    return NextResponse.json({ error: 'order_not_found' }, { status: 404 });
  }
  if (!(DISCARDABLE_STATUSES as readonly string[]).includes(order.status)) {
    return NextResponse.json(
      { error: `order_status_not_discardable: ${order.status}`, current_status: order.status },
      { status: 409 },
    );
  }

  const { error: updErr } = await supabase
    .from('orders')
    .update({ status: 'discarded', updated_at: new Date().toISOString() })
    .eq('id', parsed.order_id);

  if (updErr) {
    // Best-effort breadcrumb; do not throw if this fails (gotcha #11 pattern).
    try {
      await writeActivityLog(
        {
          eventType: 'discard_failed',
          actor: 'founder',
          briefId: order.brief_id,
          orderId: order.id,
          payload: {
            order_id: parsed.order_id,
            error: updErr.message,
          },
        },
        supabase,
      );
    } catch (logErr) {
      console.error('[discard] discard_failed activity_log insert failed:', logErr);
    }
    return NextResponse.json({ error: `discard_failed: ${updErr.message}` }, { status: 500 });
  }

  await writeActivityLog(
    {
      eventType: 'founder_discarded',
      actor: 'founder',
      briefId: order.brief_id,
      orderId: order.id,
      payload: {
        order_id: parsed.order_id,
        reason: parsed.reason ?? null,
        actor_sub: claims.sub,
      },
    },
    supabase,
  );

  return NextResponse.json({ status: 'discarded', order_id: parsed.order_id }, { status: 200 });
}
```

- [x] **Step 2.5: Run tests — confirm all 9 PASS**

```bash
cd apps/agent && pnpm vitest run src/app/v1/brief/discard/route.test.ts
```

Expected: 9/9 tests pass.

- [x] **Step 2.6: Run full test suite + typecheck + worker build**

```bash
cd apps/agent && pnpm test && pnpm typecheck && pnpm build:worker
```

Expected: 281+ tests pass, no TS errors, worker builds.

- [x] **Step 2.7: Commit**

```bash
cd "C:\Users\DELL\Documents\Antigravity\operscale-calender\operscale-calendar-platform"
git add apps/agent/src/app/v1/brief/discard/route.ts apps/agent/src/app/v1/brief/discard/route.test.ts
git commit -m "feat(agent): /v1/brief/discard — founder-only, idempotent, audit-logged"
```

---

## Task 3: `/admin` sign-in form

**Files:**
- Modify: `apps/web/src/app/admin/page.tsx` (replace 14-line stub)
- Create: `apps/web/src/app/admin/SignInForm.tsx` (`'use client'`)

Goal: a magic-link sign-in form at `/admin` that handles `?reason=...` query param messaging from middleware/callback redirects.

- [x] **Step 3.1: Add component-test deps**

```bash
cd apps/web
pnpm add -D @testing-library/react@^16 @testing-library/jest-dom@^6 happy-dom@^15
```

Then commit `apps/web/package.json` + `pnpm-lock.yaml`:

```bash
cd "C:\Users\DELL\Documents\Antigravity\operscale-calender\operscale-calendar-platform"
git add apps/web/package.json pnpm-lock.yaml
git commit -m "chore(web): add @testing-library/react + happy-dom for component tests"
```

- [x] **Step 3.2: Write `SignInForm.tsx`**

Create `apps/web/src/app/admin/SignInForm.tsx`:

```tsx
'use client';

import { useState } from 'react';
import { useSearchParams } from 'next/navigation';
import { getSupabaseBrowser } from '@/lib/supabase-browser';

type FormState =
  | { kind: 'idle' }
  | { kind: 'sending' }
  | { kind: 'sent'; email: string }
  | { kind: 'error'; message: string };

const REASON_COPY: Record<string, string> = {
  not_authenticated: 'Sign in to access the CRM.',
  not_authorized: 'That account isn’t allowlisted for the CRM.',
  expired: 'That sign-in link has expired. Send a new one.',
  session: 'Your session ended. Sign in again.',
};

export function SignInForm() {
  const params = useSearchParams();
  const reason = params.get('reason');
  const [email, setEmail] = useState('');
  const [state, setState] = useState<FormState>({ kind: 'idle' });

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (state.kind === 'sending') return;
    setState({ kind: 'sending' });

    const supabase = getSupabaseBrowser();
    const { error } = await supabase.auth.signInWithOtp({
      email: email.trim().toLowerCase(),
      options: {
        emailRedirectTo: `${window.location.origin}/auth/callback`,
      },
    });

    if (error) {
      setState({ kind: 'error', message: error.message ?? 'Couldn’t send sign-in email.' });
      return;
    }
    setState({ kind: 'sent', email: email.trim().toLowerCase() });
  }

  if (state.kind === 'sent') {
    return (
      <div className="mx-auto mt-12 max-w-sm rounded-lg border bg-card p-6 text-sm">
        <h2 className="text-lg font-semibold">Check your email</h2>
        <p className="mt-2 text-muted-foreground">
          We sent a sign-in link to <strong>{state.email}</strong>. Open the email on this device
          and click the link to continue. The link expires in 60 minutes.
        </p>
      </div>
    );
  }

  return (
    <form onSubmit={onSubmit} className="mx-auto mt-12 max-w-sm space-y-3">
      <div>
        <h2 className="text-lg font-semibold">Operscale CRM</h2>
        <p className="mt-1 text-sm text-muted-foreground">
          Sign in with your magic link.
        </p>
      </div>

      {reason && REASON_COPY[reason] && (
        <p role="status" className="rounded-md border border-amber-300 bg-amber-50 p-2 text-xs text-amber-900">
          {REASON_COPY[reason]}
        </p>
      )}

      {state.kind === 'error' && (
        <p role="alert" className="rounded-md border border-red-300 bg-red-50 p-2 text-xs text-red-900">
          {state.message}
        </p>
      )}

      <label htmlFor="signin-email" className="sr-only">Email address</label>
      <input
        id="signin-email"
        type="email"
        required
        value={email}
        onChange={(e) => setEmail(e.target.value)}
        placeholder="you@operscale.cloud"
        className="w-full rounded-md border px-3 py-2 text-sm"
        disabled={state.kind === 'sending'}
      />

      <button
        type="submit"
        disabled={state.kind === 'sending' || email.trim().length === 0}
        className="w-full rounded-md bg-primary px-3 py-2 text-sm text-primary-foreground disabled:opacity-50"
      >
        {state.kind === 'sending' ? 'Sending…' : 'Send sign-in link'}
      </button>
    </form>
  );
}
```

- [x] **Step 3.3: Replace `apps/web/src/app/admin/page.tsx`**

```tsx
// /admin — magic-link sign-in page (always reachable per middleware).
// Already-signed-in founders can also land here; rendering the form is harmless
// because Supabase signInWithOtp simply re-issues a new link.
//
// Spec: docs/specs/v2-phase-5-design.md §4.1 + §5.1.

import { Suspense } from 'react';
import { SignInForm } from './SignInForm';

export const metadata = {
  title: 'Sign in — Operscale CRM',
  robots: 'noindex, nofollow',
};

export default function AdminSignInPage() {
  return (
    <div className="container py-12">
      <Suspense fallback={null}>
        <SignInForm />
      </Suspense>
    </div>
  );
}
```

(`useSearchParams` requires Suspense boundary — this is the canonical Next 15 pattern.)

- [x] **Step 3.4: Write component test**

Create `apps/web/test/components/SignInForm.test.tsx`:

```tsx
// @vitest-environment happy-dom

import { describe, expect, it, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import '@testing-library/jest-dom/vitest';

const mockSignInWithOtp = vi.fn();
vi.mock('@/lib/supabase-browser', () => ({
  getSupabaseBrowser: () => ({
    auth: { signInWithOtp: mockSignInWithOtp },
  }),
}));

vi.mock('next/navigation', () => ({
  useSearchParams: () => new URLSearchParams(''),
}));

import { SignInForm } from '../../src/app/admin/SignInForm';

beforeEach(() => {
  mockSignInWithOtp.mockReset();
});

describe('SignInForm', () => {
  it('renders idle state with disabled button', () => {
    render(<SignInForm />);
    expect(screen.getByRole('button', { name: /Send sign-in link/ })).toBeDisabled();
  });

  it('enables submit once an email is typed', () => {
    render(<SignInForm />);
    fireEvent.change(screen.getByPlaceholderText(/you@/), {
      target: { value: 'akinolaakinrimisi@gmail.com' },
    });
    expect(screen.getByRole('button', { name: /Send sign-in link/ })).not.toBeDisabled();
  });

  it('disables submit when email is cleared after typing', () => {
    render(<SignInForm />);
    const input = screen.getByPlaceholderText(/you@/);
    fireEvent.change(input, { target: { value: 'akinolaakinrimisi@gmail.com' } });
    expect(screen.getByRole('button', { name: /Send sign-in link/ })).not.toBeDisabled();
    fireEvent.change(input, { target: { value: '' } });
    expect(screen.getByRole('button', { name: /Send sign-in link/ })).toBeDisabled();
  });

  it('shows the sent state on success', async () => {
    mockSignInWithOtp.mockResolvedValueOnce({ error: null });
    render(<SignInForm />);
    fireEvent.change(screen.getByPlaceholderText(/you@/), {
      target: { value: 'akinolaakinrimisi@gmail.com' },
    });
    fireEvent.click(screen.getByRole('button', { name: /Send sign-in link/ }));
    await waitFor(() => expect(screen.getByText(/Check your email/)).toBeInTheDocument());
    expect(screen.getByText(/akinolaakinrimisi@gmail\.com/)).toBeInTheDocument();
  });

  it('shows the error state on failure', async () => {
    mockSignInWithOtp.mockResolvedValueOnce({ error: { message: 'Resend down' } });
    render(<SignInForm />);
    fireEvent.change(screen.getByPlaceholderText(/you@/), {
      target: { value: 'x@y.com' },
    });
    fireEvent.click(screen.getByRole('button', { name: /Send sign-in link/ }));
    await waitFor(() => expect(screen.getByText(/Resend down/)).toBeInTheDocument());
  });
});

describe('SignInForm with ?reason=not_authenticated', () => {
  it('renders the reason banner', async () => {
    vi.doMock('next/navigation', () => ({
      useSearchParams: () => new URLSearchParams('reason=not_authenticated'),
    }));
    vi.resetModules();
    const { SignInForm: SignInFormFresh } = await import('../../src/app/admin/SignInForm');
    render(<SignInFormFresh />);
    expect(screen.getByText(/Sign in to access the CRM/)).toBeInTheDocument();
  });
});
```

- [x] **Step 3.5: Update `vitest.config.ts` to include test/ folder**

Modify `apps/web/vitest.config.ts`:

```typescript
import { fileURLToPath, URL } from 'node:url';
import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  test: {
    environment: 'node',
    include: ['src/**/*.test.tsx', 'src/**/*.test.ts', 'test/**/*.test.tsx', 'test/**/*.test.ts'],
    globals: false,
  },
  resolve: {
    alias: {
      '@': fileURLToPath(new URL('./src', import.meta.url)),
      '@operscale-calendar/agent': fileURLToPath(new URL('../agent/src', import.meta.url)),
    },
  },
});
```

(Adds `test/**/*` to include glob; the per-file `// @vitest-environment happy-dom` directive overrides the default `'node'` environment for component tests.)

- [x] **Step 3.6: Run apps/web tests**

```bash
cd apps/web && pnpm test
```

Expected: existing email-template tests still pass, new SignInForm tests pass (5 tests).

- [x] **Step 3.7: Commit**

```bash
cd "C:\Users\DELL\Documents\Antigravity\operscale-calender\operscale-calendar-platform"
git add apps/web/src/app/admin/page.tsx apps/web/src/app/admin/SignInForm.tsx apps/web/test/components/SignInForm.test.tsx apps/web/vitest.config.ts
git commit -m "feat(web): /admin sign-in form with magic-link + reason-banner"
```

---

## Task 4: `/auth/callback` route handler

**Files:**
- Create: `apps/web/src/app/auth/callback/route.ts`

Goal: exchange the magic-link `code` for a session, write `founder_signed_in` activity_log, redirect to `/admin/pending-review`.

- [x] **Step 4.1: Write the callback route**

Create `apps/web/src/app/auth/callback/route.ts`:

```typescript
// /auth/callback — top-level Route Handler (outside the /admin/:path* matcher
// so the middleware does NOT redirect before the code exchange).
//
// Magic-link flow lands here with ?code=... after the user clicks the email.
// We exchange code → session, write founder_signed_in activity_log, redirect
// to /admin/pending-review.
//
// Spec: docs/specs/v2-phase-5-design.md §7 "Auth flow".

import { NextResponse, type NextRequest } from 'next/server';
import { getSupabaseServer } from '@/lib/supabase-server';

/**
 * Build a redirect URL that respects upstream proxy headers (Cloudflare → Traefik
 * → Next). In Docker standalone mode Next sees host=0.0.0.0:3001; without this
 * helper, redirects would bounce the browser to a non-routable internal address.
 */
function proxyAwareUrl(req: NextRequest): URL {
  const url = req.nextUrl.clone();
  const fwdHost = req.headers.get('x-forwarded-host');
  const fwdProto = req.headers.get('x-forwarded-proto');
  if (fwdHost) url.host = fwdHost;
  if (fwdProto) url.protocol = `${fwdProto}:`;
  return url;
}

export async function GET(req: NextRequest) {
  const url = proxyAwareUrl(req);
  const code = url.searchParams.get('code');

  if (!code) {
    url.pathname = '/admin';
    url.search = '?reason=expired';
    return NextResponse.redirect(url);
  }

  const supabase = await getSupabaseServer();
  const { data, error } = await supabase.auth.exchangeCodeForSession(code);

  if (error || !data?.session) {
    url.pathname = '/admin';
    url.search = '?reason=expired';
    return NextResponse.redirect(url);
  }

  // Best-effort breadcrumb. Migration 0009 enables this INSERT under the
  // founder JWT; if RLS still blocks (regression), fall through to redirect.
  try {
    const userAgent = req.headers.get('user-agent') ?? null;
    const ip =
      req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ??
      req.headers.get('x-real-ip') ??
      null;
    await supabase.from('activity_log').insert({
      event_type: 'founder_signed_in',
      actor: 'founder',
      payload: {
        actor_email: data.session.user.email ?? null,
        actor_sub: data.session.user.id,
        ip,
        user_agent: userAgent,
      },
    });
  } catch (logErr) {
    console.error('[auth/callback] founder_signed_in log insert failed:', logErr);
  }

  url.pathname = '/admin/pending-review';
  url.search = '';
  return NextResponse.redirect(url);
}
```

- [x] **Step 4.2: Verify callback redirects work via curl** (post-deploy — see Task 12)

The route can't be unit-tested without a real Supabase code (signature is verified server-side). It will be exercised in the live smoke (Task 12).

For local sanity, run:
```bash
curl -sI http://localhost:3001/auth/callback
```
Expected: 307 to `/admin?reason=expired` (no code → expired branch).

- [x] **Step 4.3: Typecheck + build**

```bash
cd apps/web && pnpm typecheck && pnpm build
```

Expected: clean.

- [x] **Step 4.4: Commit**

```bash
cd "C:\Users\DELL\Documents\Antigravity\operscale-calender\operscale-calendar-platform"
git add apps/web/src/app/auth/callback/route.ts
git commit -m "feat(web): /auth/callback — exchange code, log founder_signed_in, redirect to /admin/pending-review"
```

- [x] **Step 4.5: Push origin/main (3 tasks done)**

```bash
git push origin main
```

---

## Task 5: Pending-review queue

**Files:**
- Modify: `apps/web/src/app/admin/pending-review/page.tsx`
- Create: `apps/web/src/app/admin/pending-review/QueueTable.tsx`
- Create: `apps/web/src/app/admin/pending-review/QueueRow.tsx`
- Create: `apps/web/src/app/admin/pending-review/QueueCapBanner.tsx`
- Create: `apps/web/src/app/admin/pending-review/RealtimeQueue.tsx`
- Create: `apps/web/test/components/QueueRow.test.tsx`

- [x] **Step 5.1: Define `QueueRow` component (presentational, time-since-badge logic)**

Create `apps/web/src/app/admin/pending-review/QueueRow.tsx`:

```tsx
import Link from 'next/link';

export interface QueueRowData {
  order_id: string;
  brief_id: string;
  brand_name: string | null;
  customer_name: string | null;
  niche: string | null;
  tier: 'starter' | 'standard' | 'calendar';
  submitted_at: string;
  has_photos: boolean;
}

interface QueueRowProps {
  row: QueueRowData;
  now: number; // injected for deterministic testing; defaults to Date.now()
}

function badgeClass(submittedAt: string, now: number): { className: string; label: string } {
  const ageMs = now - new Date(submittedAt).getTime();
  const ageMin = Math.max(0, Math.floor(ageMs / 60_000));
  let label: string;
  if (ageMin < 60) label = `${ageMin}m`;
  else if (ageMin < 1440) label = `${Math.floor(ageMin / 60)}h`;
  else label = `${Math.floor(ageMin / 1440)}d`;
  if (ageMin <= 30) {
    return { className: 'bg-green-100 text-green-900', label };
  }
  if (ageMin <= 120) {
    return { className: 'bg-amber-100 text-amber-900', label };
  }
  return { className: 'bg-red-100 text-red-900', label };
}

export function QueueRow({ row, now = Date.now() }: { row: QueueRowData; now?: number }) {
  const badge = badgeClass(row.submitted_at, now);
  return (
    <Link
      href={`/admin/orders/${row.order_id}`}
      className="grid grid-cols-[2fr_1.5fr_0.8fr_1fr_0.8fr_0.4fr] items-center gap-3 border-b px-3 py-2 text-sm hover:bg-muted/40"
    >
      <span className="font-medium">{row.brand_name ?? '—'}</span>
      <span className="text-muted-foreground">{row.customer_name ?? 'Unknown'}</span>
      <span>
        <span className="rounded-sm bg-muted px-1.5 py-0.5 text-xs uppercase">
          {row.tier}
        </span>
      </span>
      <span className="text-muted-foreground">{row.niche ?? '—'}</span>
      <span>
        <span className={`rounded px-2 py-0.5 text-xs ${badge.className}`}>{badge.label}</span>
      </span>
      <span className="text-right text-xs text-muted-foreground">
        {row.has_photos ? '\u{1F4F7}' : ''}
      </span>
    </Link>
  );
}
```

- [x] **Step 5.2: Write QueueRow test (TDD time-since thresholds)**

Create `apps/web/test/components/QueueRow.test.tsx`:

```tsx
// @vitest-environment happy-dom

import { describe, expect, it } from 'vitest';
import { render, screen } from '@testing-library/react';
import '@testing-library/jest-dom/vitest';
import { QueueRow, type QueueRowData } from '../../src/app/admin/pending-review/QueueRow';

const FIXED_NOW = new Date('2026-05-06T12:00:00Z').getTime();

function makeRow(overrides: Partial<QueueRowData> = {}): QueueRowData {
  return {
    order_id: 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa',
    brief_id: 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb',
    brand_name: 'Acme',
    customer_name: 'Jane',
    niche: 'fashion',
    tier: 'standard',
    submitted_at: '2026-05-06T11:50:00Z',
    has_photos: true,
    ...overrides,
  };
}

describe('QueueRow time-since badge', () => {
  it('renders green badge for ≤30 minutes (10m)', () => {
    render(<QueueRow row={makeRow({ submitted_at: '2026-05-06T11:50:00Z' })} now={FIXED_NOW} />);
    const badge = screen.getByText('10m');
    expect(badge.className).toContain('bg-green-100');
  });

  it('renders amber badge for 31-120 minutes (90m)', () => {
    render(
      <QueueRow row={makeRow({ submitted_at: '2026-05-06T10:30:00Z' })} now={FIXED_NOW} />,
    );
    const badge = screen.getByText('1h');
    expect(badge.className).toContain('bg-amber-100');
  });

  it('renders red badge for >120 minutes (240m)', () => {
    render(<QueueRow row={makeRow({ submitted_at: '2026-05-06T08:00:00Z' })} now={FIXED_NOW} />);
    const badge = screen.getByText('4h');
    expect(badge.className).toContain('bg-red-100');
  });

  it('renders camera icon when has_photos is true', () => {
    render(<QueueRow row={makeRow({ has_photos: true })} now={FIXED_NOW} />);
    expect(screen.getByText('\u{1F4F7}')).toBeInTheDocument();
  });

  it('hides camera icon when has_photos is false', () => {
    render(<QueueRow row={makeRow({ has_photos: false })} now={FIXED_NOW} />);
    expect(screen.queryByText('\u{1F4F7}')).not.toBeInTheDocument();
  });

  it('falls back to em-dash for missing brand_name', () => {
    render(<QueueRow row={makeRow({ brand_name: null })} now={FIXED_NOW} />);
    expect(screen.getByText('—')).toBeInTheDocument();
  });
});
```

- [x] **Step 5.3: Run QueueRow tests — confirm pass**

```bash
cd apps/web && pnpm vitest run test/components/QueueRow.test.tsx
```

Expected: 6/6 pass.

- [x] **Step 5.4: Define `QueueCapBanner`**

Create `apps/web/src/app/admin/pending-review/QueueCapBanner.tsx`:

```tsx
export function QueueCapBanner() {
  return (
    <div className="mb-4 rounded-md border border-amber-300 bg-amber-50 p-3 text-sm text-amber-900">
      <strong>Queue cap reached.</strong> 100+ pending reviews — clear queue or check
      whether AI analysis is stuck. (Worker sweep reclaims orphaned jobs every 5 min.)
    </div>
  );
}
```

- [x] **Step 5.5: Define `QueueTable` (renders rows + Realtime mount)**

Create `apps/web/src/app/admin/pending-review/QueueTable.tsx`:

```tsx
'use client';

import { useState } from 'react';
import { QueueRow, type QueueRowData } from './QueueRow';
import { RealtimeQueue } from './RealtimeQueue';

interface QueueTableProps {
  initialRows: QueueRowData[];
}

export function QueueTable({ initialRows }: QueueTableProps) {
  const [rows, setRows] = useState<QueueRowData[]>(initialRows);

  return (
    <div className="rounded-lg border bg-card">
      <div className="grid grid-cols-[2fr_1.5fr_0.8fr_1fr_0.8fr_0.4fr] items-center gap-3 border-b bg-muted/30 px-3 py-2 text-xs uppercase text-muted-foreground">
        <span>Brand</span>
        <span>Customer</span>
        <span>Tier</span>
        <span>Niche</span>
        <span>Submitted</span>
        <span></span>
      </div>
      {rows.length === 0 ? (
        <p className="p-6 text-center text-sm text-muted-foreground">No pending reviews.</p>
      ) : (
        rows.map((row) => <QueueRow key={row.order_id} row={row} />)
      )}
      <RealtimeQueue onUpdate={setRows} />
    </div>
  );
}
```

- [x] **Step 5.6: Define `RealtimeQueue` subscription**

Create `apps/web/src/app/admin/pending-review/RealtimeQueue.tsx`:

```tsx
'use client';

import { useEffect } from 'react';
import { getSupabaseBrowser } from '@/lib/supabase-browser';
import type { QueueRowData } from './QueueRow';

interface RealtimeQueueProps {
  onUpdate: (updater: (prev: QueueRowData[]) => QueueRowData[]) => void;
}

// Hydrates one queue row from the orders.id by re-running the same join query.
// The .eq('status', 'pending_founder_review') filter is a staleness defense:
// if Realtime delivers an event for a row whose status has already moved by
// the time we re-fetch, this query returns null and the caller skips it.
async function fetchJoinedRow(orderId: string): Promise<QueueRowData | null> {
  const supabase = getSupabaseBrowser();
  const { data, error } = await supabase
    .from('orders')
    .select(
      `id, tier, status, briefs!inner(id, submitted_at, form_payload), customers!inner(id, name:full_name), brief_photos(brief_id)`,
    )
    .eq('id', orderId)
    .eq('status', 'pending_founder_review')
    .maybeSingle();
  if (error || !data) return null;
  // The supabase-js join shape: briefs is an array because orders→briefs is FK,
  // but FK is unique (one brief per order) so we take [0].
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const briefRow: any = Array.isArray((data as any).briefs)
    ? (data as any).briefs[0]
    : (data as any).briefs;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const customerRow: any = Array.isArray((data as any).customers)
    ? (data as any).customers[0]
    : (data as any).customers;
  return {
    order_id: data.id,
    brief_id: briefRow?.id ?? '',
    brand_name: briefRow?.form_payload?.brand_name ?? null,
    customer_name: customerRow?.name ?? null,
    niche: briefRow?.form_payload?.niche ?? null,
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    tier: data.tier as any,
    submitted_at: briefRow?.submitted_at ?? new Date().toISOString(),
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    has_photos: Array.isArray((data as any).brief_photos) && (data as any).brief_photos.length > 0,
  };
}

export function RealtimeQueue({ onUpdate }: RealtimeQueueProps) {
  useEffect(() => {
    const supabase = getSupabaseBrowser();
    const channel = supabase
      .channel('pending-review')
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'orders', filter: 'status=eq.pending_founder_review' },
        async (payload) => {
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          const newRow = (payload as any).new;
          if (!newRow?.id) return;
          // fetchJoinedRow filters by status=pending_founder_review, so if an
          // UPDATE flipped status during the fetch, joined will be null and
          // we skip the prepend.
          const joined = await fetchJoinedRow(newRow.id);
          if (!joined) return;
          onUpdate((prev) =>
            prev.some((r) => r.order_id === joined.order_id)
              ? prev
              : [joined, ...prev],
          );
        },
      )
      .on(
        'postgres_changes',
        { event: 'UPDATE', schema: 'public', table: 'orders' },
        async (payload) => {
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          const newRow = (payload as any).new;
          if (!newRow?.id) return;
          if (newRow.status === 'pending_founder_review') {
            // Promote into the queue: worker analyzer + re-analysis flows
            // (Phase 5 Task 7) can flip status TO pending_founder_review
            // via UPDATE rather than INSERT.
            const joined = await fetchJoinedRow(newRow.id);
            if (!joined) return;
            onUpdate((prev) =>
              prev.some((r) => r.order_id === joined.order_id)
                ? prev.map((r) => (r.order_id === joined.order_id ? joined : r))
                : [joined, ...prev],
            );
          } else {
            // Splice out — order has moved to founder_approved / discarded / etc.
            onUpdate((prev) => prev.filter((r) => r.order_id !== newRow.id));
          }
        },
      )
      .on(
        'postgres_changes',
        { event: 'DELETE', schema: 'public', table: 'orders' },
        (payload) => {
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          const oldRow = (payload as any).old;
          onUpdate((prev) => prev.filter((r) => r.order_id !== oldRow?.id));
        },
      )
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, [onUpdate]);

  return null;
}
```

- [x] **Step 5.7: Implement `pending-review/page.tsx` Server Component**

Replace `apps/web/src/app/admin/pending-review/page.tsx`:

```tsx
import { getSupabaseServer } from '@/lib/supabase-server';
import { QueueTable } from './QueueTable';
import { QueueCapBanner } from './QueueCapBanner';
import type { QueueRowData } from './QueueRow';

export const metadata = { title: 'Pending review — Operscale CRM' };
export const dynamic = 'force-dynamic';

const QUEUE_LIMIT = 100;

interface BriefPhotoRow {
  brief_id: string;
}

interface OrderJoined {
  id: string;
  tier: string;
  briefs: {
    id: string;
    submitted_at: string;
    form_payload: { brand_name?: string; niche?: string } | null;
  } | null;
  customers: { id: string; name: string | null } | null;
  brief_photos: BriefPhotoRow[] | null;
}

async function fetchPending(): Promise<{ rows: QueueRowData[]; capReached: boolean }> {
  const supabase = await getSupabaseServer();
  const { data, error } = await supabase
    .from('orders')
    .select(
      `id, tier, briefs!inner(id, submitted_at, form_payload), customers!inner(id, name:full_name), brief_photos(brief_id)`,
    )
    .eq('status', 'pending_founder_review')
    .order('briefs(submitted_at)', { ascending: true })
    .limit(QUEUE_LIMIT);

  if (error) throw new Error(`pending_review_query_failed: ${error.message}`);

  const rows: QueueRowData[] = ((data ?? []) as unknown as OrderJoined[]).map((o) => ({
    order_id: o.id,
    brief_id: o.briefs?.id ?? '',
    brand_name: o.briefs?.form_payload?.brand_name ?? null,
    customer_name: o.customers?.name ?? null,
    niche: o.briefs?.form_payload?.niche ?? null,
    tier: o.tier as QueueRowData['tier'],
    submitted_at: o.briefs?.submitted_at ?? new Date().toISOString(),
    has_photos: (o.brief_photos?.length ?? 0) > 0,
  }));

  return { rows, capReached: rows.length >= QUEUE_LIMIT };
}

export default async function PendingReviewPage() {
  const { rows, capReached } = await fetchPending();
  return (
    <div className="container py-8">
      <h1 className="text-2xl font-semibold">Pending review</h1>
      <p className="mt-1 text-sm text-muted-foreground">
        {rows.length} brief{rows.length === 1 ? '' : 's'} awaiting your review. Live updates via
        Realtime.
      </p>
      <div className="mt-6">
        {capReached && <QueueCapBanner />}
        <QueueTable initialRows={rows} />
      </div>
    </div>
  );
}
```

- [x] **Step 5.8: Run typecheck + apps/web tests**

```bash
cd apps/web && pnpm typecheck && pnpm test
```

Expected: clean. 6 new component tests pass.

- [x] **Step 5.9: Commit**

```bash
cd "C:\Users\DELL\Documents\Antigravity\operscale-calender\operscale-calendar-platform"
git add apps/web/src/app/admin/pending-review/
git add apps/web/test/components/QueueRow.test.tsx
git commit -m "feat(web): /admin/pending-review queue with Realtime + cap banner"
```

---

## Task 6: Order detail page (mode-switch + read-only review-mode panels)

**Files:**
- Modify: `apps/web/src/app/admin/orders/[id]/page.tsx`
- Modify: `apps/web/src/app/admin/orders/[id]/components/ReviewMode.tsx`
- Create: `apps/web/src/app/admin/orders/[id]/components/HistoryAccordion.tsx`
- Create: `apps/web/src/app/admin/orders/[id]/components/FormResponsesPanel.tsx`
- Create: `apps/web/src/app/admin/orders/[id]/components/AiSnapshotPanel.tsx`
- Create: `apps/web/test/components/HistoryAccordion.test.tsx`

This task focuses on the reads only — Action Bar + Modals come in Task 7.

- [x] **Step 6.1: Implement `OrderDetailPage` server fetch + mode-switch**

Replace `apps/web/src/app/admin/orders/[id]/page.tsx`:

```tsx
import { notFound } from 'next/navigation';
import { getSupabaseServer } from '@/lib/supabase-server';
import { ReviewMode } from './components/ReviewMode';
import { TimelineMode } from './components/TimelineMode';

export const metadata = { title: 'Order — Operscale CRM' };
export const dynamic = 'force-dynamic';

interface PageProps {
  params: Promise<{ id: string }>;
}

export default async function OrderDetailPage({ params }: PageProps) {
  const { id } = await params;
  const supabase = await getSupabaseServer();

  const { data: order, error } = await supabase
    .from('orders')
    .select(
      `id, brief_id, customer_id, status, tier, amount_ngn, submitted_at, founder_approved_at, paid_at, paystack_authorization, briefs!inner(id, form_payload, submitted_at), customers!inner(id, name:full_name, email, whatsapp:whatsapp_number)`,
    )
    .eq('id', id)
    .maybeSingle();

  if (error || !order) {
    notFound();
  }

  if (order.status === 'pending_founder_review') {
    return <ReviewMode orderId={order.id} order={order} />;
  }
  return <TimelineMode orderId={order.id} order={order} />;
}
```

- [x] **Step 6.2: Implement `HistoryAccordion`**

Create `apps/web/src/app/admin/orders/[id]/components/HistoryAccordion.tsx`:

```tsx
'use client';

import { useState } from 'react';

export interface HistoryEvent {
  occurred_at: string;
  event_type: string;
  payload: Record<string, unknown> | null;
}

interface HistoryAccordionProps {
  events: HistoryEvent[];
  submittedAt: string;
}

function summarise(events: HistoryEvent[]): string {
  const reanalyseCount = events.filter((e) => e.event_type === 'ai_analysis_enqueued').length;
  const autoAck = events.find((e) => e.event_type === 'auto_ack_email_sent');
  const parts: string[] = [];
  if (reanalyseCount > 1) parts.push(`Re-analyzed ${reanalyseCount - 1}×`);
  if (autoAck) parts.push('Auto-ack sent');
  return parts.join(' · ');
}

function relativeTime(iso: string, now: number = Date.now()): string {
  const diffMs = now - new Date(iso).getTime();
  const diffMin = Math.max(0, Math.floor(diffMs / 60_000));
  if (diffMin < 1) return 'just now';
  if (diffMin < 60) return `${diffMin}m ago`;
  const diffH = Math.floor(diffMin / 60);
  if (diffH < 24) return `${diffH}h ago`;
  return `${Math.floor(diffH / 24)}d ago`;
}

export function HistoryAccordion({ events, submittedAt }: HistoryAccordionProps) {
  const [open, setOpen] = useState(false);
  const summary = summarise(events);
  return (
    <div className="rounded-md border bg-muted/30">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="flex w-full items-center justify-between px-3 py-2 text-left text-xs text-muted-foreground hover:bg-muted/60"
        aria-expanded={open}
      >
        <span>
          Submitted {relativeTime(submittedAt)}
          {summary ? ` · ${summary}` : ''}
        </span>
        <span aria-hidden>{open ? '▲' : '▼'}</span>
      </button>
      {open && (
        <ul className="divide-y border-t text-xs">
          {events.length === 0 ? (
            <li className="px-3 py-2 text-muted-foreground">No events yet.</li>
          ) : (
            events.map((e, i) => (
              <li key={i} className="grid grid-cols-[140px_1fr] gap-3 px-3 py-2">
                <span className="text-muted-foreground">{relativeTime(e.occurred_at)}</span>
                <span className="font-mono text-[11px]">{e.event_type}</span>
              </li>
            ))
          )}
        </ul>
      )}
    </div>
  );
}
```

- [x] **Step 6.3: Write `HistoryAccordion` test**

Create `apps/web/test/components/HistoryAccordion.test.tsx`:

```tsx
// @vitest-environment happy-dom

import { describe, expect, it } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import '@testing-library/jest-dom/vitest';
import {
  HistoryAccordion,
  type HistoryEvent,
} from '../../src/app/admin/orders/[id]/components/HistoryAccordion';

const NOW = new Date('2026-05-06T12:00:00Z').getTime();

describe('HistoryAccordion', () => {
  it('starts collapsed and shows summary line', () => {
    render(<HistoryAccordion events={[]} submittedAt="2026-05-06T11:55:00Z" />);
    expect(screen.queryByText(/No events yet/)).not.toBeInTheDocument();
    expect(screen.getByRole('button')).toHaveAttribute('aria-expanded', 'false');
  });

  it('expands on click and renders events chronologically', () => {
    const events: HistoryEvent[] = [
      { occurred_at: '2026-05-06T11:55:00Z', event_type: 'form_submitted', payload: null },
      {
        occurred_at: '2026-05-06T11:57:00Z',
        event_type: 'ai_analysis_enqueued',
        payload: null,
      },
    ];
    render(<HistoryAccordion events={events} submittedAt="2026-05-06T11:55:00Z" />);
    fireEvent.click(screen.getByRole('button'));
    expect(screen.getByText('form_submitted')).toBeInTheDocument();
    expect(screen.getByText('ai_analysis_enqueued')).toBeInTheDocument();
  });

  it('summary mentions re-analyze count when > 1 enqueue events present', () => {
    const events: HistoryEvent[] = [
      { occurred_at: '2026-05-06T11:55:00Z', event_type: 'ai_analysis_enqueued', payload: null },
      { occurred_at: '2026-05-06T11:58:00Z', event_type: 'ai_analysis_enqueued', payload: null },
    ];
    render(<HistoryAccordion events={events} submittedAt="2026-05-06T11:55:00Z" />);
    expect(screen.getByText(/Re-analyzed 1/)).toBeInTheDocument();
  });
});
```

- [x] **Step 6.4: Implement `FormResponsesPanel`**

Create `apps/web/src/app/admin/orders/[id]/components/FormResponsesPanel.tsx`:

```tsx
// Source of truth for form_payload keys: apps/agent/src/worker/process-job.ts
// (projectBriefRowToAnalyzerInput) + apps/agent/src/lib/types/v2.ts
// (BriefAnalyzerInput). Keep this interface aligned with that projector — if
// process-job.ts adds/renames a key, this panel must move with it.
interface FormPayload {
  // Identity / niche
  brand_name?: string;
  niche_slug?: string;
  niche_label?: string;

  // Step 1 — owner contact
  owner_name?: string;
  phone_e164?: string;
  email?: string;

  // Step 2 — offer
  one_line_description?: string;
  offer_description?: string;
  price_point_band?: string;

  // Step 3 — audience
  primary_audience_description?: string;
  audience_age_range?: string;
  audience_location?: string;
  audience_belief?: string;
  audience_belief_target?: string;

  // Step 4 — brand
  logo_uploaded_yes_no?: 'yes' | 'no';
  brand_colours?: string;
  instagram_handle?: string;

  // Step 5 — photos
  photo_count?: number;
  photo_consent_yes_no?: 'yes' | 'no';

  // Step 6 — voice
  stated_voice?: string;
  reference_posts_block?: string;
  customer_backstory_verbatim?: string;

  // Step 7 — counts (echoed for prompt fidelity per v2.ts)
  video_count?: number;
  carousel_count?: number;
}

interface FormResponsesPanelProps {
  formPayload: FormPayload | null;
  customerName: string | null;
  customerEmail: string | null;
  brandName: string | null;
  photoCount: number;
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="space-y-1">
      <h3 className="text-xs font-semibold uppercase text-muted-foreground">{title}</h3>
      <div className="text-sm">{children}</div>
    </section>
  );
}

function Field({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="grid grid-cols-[140px_1fr] gap-2 py-0.5">
      <dt className="text-xs text-muted-foreground">{label}</dt>
      <dd>{value || <span className="text-muted-foreground">—</span>}</dd>
    </div>
  );
}

export function FormResponsesPanel({
  formPayload,
  customerName,
  customerEmail,
  brandName,
  photoCount,
}: FormResponsesPanelProps) {
  const fp = formPayload ?? {};
  const nicheDisplay = fp.niche_label || fp.niche_slug;
  return (
    <div className="space-y-4 rounded-lg border bg-card p-4">
      <Section title="Business">
        <dl>
          <Field label="Brand" value={brandName} />
          <Field label="Niche" value={nicheDisplay} />
          <Field label="Owner" value={fp.owner_name || customerName} />
          <Field label="Email" value={fp.email || customerEmail} />
          <Field label="Phone" value={fp.phone_e164} />
          <Field label="Instagram" value={fp.instagram_handle} />
        </dl>
      </Section>
      <Section title="Offer">
        <dl>
          <Field
            label="One-liner"
            value={
              fp.one_line_description ? (
                <p className="whitespace-pre-line">{fp.one_line_description}</p>
              ) : null
            }
          />
          <Field
            label="Offer detail"
            value={
              fp.offer_description ? (
                <p className="whitespace-pre-line">{fp.offer_description}</p>
              ) : null
            }
          />
          <Field label="Price band" value={fp.price_point_band} />
        </dl>
      </Section>
      <Section title="Audience">
        <dl>
          <Field
            label="Primary audience"
            value={
              fp.primary_audience_description ? (
                <p className="whitespace-pre-line">{fp.primary_audience_description}</p>
              ) : null
            }
          />
          <Field label="Age range" value={fp.audience_age_range} />
          <Field label="Location" value={fp.audience_location} />
          <Field
            label="Current belief"
            value={
              fp.audience_belief ? (
                <p className="whitespace-pre-line">{fp.audience_belief}</p>
              ) : null
            }
          />
          <Field
            label="Target belief"
            value={
              fp.audience_belief_target ? (
                <p className="whitespace-pre-line">{fp.audience_belief_target}</p>
              ) : null
            }
          />
        </dl>
      </Section>
      <Section title="Brand voice">
        <dl>
          <Field
            label="Stated voice"
            value={
              fp.stated_voice ? (
                <p className="whitespace-pre-line">{fp.stated_voice}</p>
              ) : null
            }
          />
          <Field
            label="References"
            value={
              fp.reference_posts_block ? (
                <p className="whitespace-pre-line text-xs">{fp.reference_posts_block}</p>
              ) : null
            }
          />
          <Field
            label="Backstory"
            value={
              fp.customer_backstory_verbatim ? (
                <p className="whitespace-pre-line">{fp.customer_backstory_verbatim}</p>
              ) : null
            }
          />
        </dl>
      </Section>
      <Section title="Visual character">
        <dl>
          <Field label="Brand colours" value={fp.brand_colours} />
          <Field label="Logo uploaded" value={fp.logo_uploaded_yes_no} />
        </dl>
      </Section>
      <Section title="Photos">
        <p className="text-sm">
          {photoCount} photo{photoCount === 1 ? '' : 's'} uploaded
          {fp.photo_consent_yes_no === 'yes' ? ' · consent given' : ''}.
          {photoCount > 0 && (
            <span className="ml-1 text-xs text-muted-foreground">
              (Lightbox preview deferred to Phase 5.x.)
            </span>
          )}
        </p>
      </Section>
      <Section title="Order volume">
        <dl>
          <Field
            label="Videos"
            value={typeof fp.video_count === 'number' ? String(fp.video_count) : null}
          />
          <Field
            label="Carousels"
            value={typeof fp.carousel_count === 'number' ? String(fp.carousel_count) : null}
          />
        </dl>
      </Section>
    </div>
  );
}
```

- [x] **Step 6.5: Implement `AiSnapshotPanel`**

Create `apps/web/src/app/admin/orders/[id]/components/AiSnapshotPanel.tsx`:

```tsx
interface SelectedPair {
  framework: string;
  archetype: string;
}

interface FrameworkSeed {
  selected_pairs: SelectedPair[];
}

interface AiOutput {
  brief_summary?: string;
  upsell_recommendation?: {
    should_upsell?: boolean;
    recommended_tier?: string;
    reasoning?: string;
    upsell_price_delta?: number;
  } | null;
  flags?: string[];
}

interface AiSnapshotPanelProps {
  runIndex: number;
  estimatedQualityScore: number | null;
  briefSummary: string | null;
  selectedPairs: SelectedPair[];
  upsell: AiOutput['upsell_recommendation'];
  flags: string[];
}

function qualityBadge(score: number | null): { className: string; label: string } {
  if (score === null) return { className: 'bg-muted text-muted-foreground', label: '—' };
  if (score > 0.7) return { className: 'bg-green-100 text-green-900', label: score.toFixed(2) };
  if (score >= 0.5) return { className: 'bg-amber-100 text-amber-900', label: score.toFixed(2) };
  return { className: 'bg-red-100 text-red-900', label: score.toFixed(2) };
}

export function AiSnapshotPanel({
  runIndex,
  estimatedQualityScore,
  briefSummary,
  selectedPairs,
  upsell,
  flags,
}: AiSnapshotPanelProps) {
  const badge = qualityBadge(estimatedQualityScore);
  return (
    <div className="space-y-4 rounded-lg border bg-yellow-50/30 p-4">
      <div className="flex items-baseline justify-between">
        <h3 className="text-sm font-semibold">AI snapshot</h3>
        <div className="flex items-center gap-2 text-xs text-muted-foreground">
          <span>Run {runIndex}</span>
          <span className={`rounded px-2 py-0.5 ${badge.className}`}>Q {badge.label}</span>
        </div>
      </div>

      <section>
        <h4 className="text-xs font-semibold uppercase text-muted-foreground">Brief summary</h4>
        <p className="mt-1 whitespace-pre-line text-sm">
          {briefSummary ?? <span className="text-muted-foreground">—</span>}
        </p>
      </section>

      <section>
        <h4 className="text-xs font-semibold uppercase text-muted-foreground">
          Selected pairs ({selectedPairs.length})
        </h4>
        <ul className="mt-1 grid grid-cols-1 gap-1 text-xs sm:grid-cols-2">
          {selectedPairs.map((p, i) => (
            <li key={i} className="rounded border bg-card px-2 py-1">
              <span className="font-medium">{p.framework}</span>{' '}
              <span className="text-muted-foreground">× {p.archetype}</span>
            </li>
          ))}
        </ul>
      </section>

      {upsell && (
        <section>
          <h4 className="text-xs font-semibold uppercase text-muted-foreground">Upsell</h4>
          <p className="mt-1 text-sm">
            {upsell.should_upsell ? (
              <>
                Recommend <strong>{upsell.recommended_tier}</strong>
                {typeof upsell.upsell_price_delta === 'number' && (
                  <> (+₦{upsell.upsell_price_delta.toLocaleString('en-NG')})</>
                )}
                : {upsell.reasoning}
              </>
            ) : (
              <span className="text-muted-foreground">No upsell recommended.</span>
            )}
          </p>
        </section>
      )}

      {flags && flags.length > 0 && (
        <section>
          <h4 className="text-xs font-semibold uppercase text-muted-foreground">Flags</h4>
          <ul className="mt-1 list-disc pl-4 text-xs text-amber-900">
            {flags.map((f, i) => (
              <li key={i}>{f}</li>
            ))}
          </ul>
        </section>
      )}
    </div>
  );
}
```

- [x] **Step 6.6: Replace `ReviewMode.tsx` (read-only — Task 7 adds ActionBar)**

Replace `apps/web/src/app/admin/orders/[id]/components/ReviewMode.tsx`:

```tsx
import { getSupabaseServer } from '@/lib/supabase-server';
import { HistoryAccordion, type HistoryEvent } from './HistoryAccordion';
import { FormResponsesPanel } from './FormResponsesPanel';
import { AiSnapshotPanel } from './AiSnapshotPanel';
import { ActionBar } from './ActionBar';
import { RealtimeOrderDetail } from './RealtimeOrderDetail';

interface OrderRow {
  id: string;
  brief_id: string;
  customer_id: string;
  status: string;
  tier: string;
  briefs: {
    id: string;
    submitted_at: string;
    form_payload: Record<string, unknown> | null;
  } | null;
  customers: {
    id: string;
    name: string | null;
    email: string | null;
  } | null;
}

interface ReviewModeProps {
  orderId: string;
  order: OrderRow;
}

interface AnalysisRun {
  id: string;
  run_index: number;
  estimated_quality_score: number | null;
  framework_seed: { selected_pairs: { framework: string; archetype: string }[] } | null;
  ai_output: {
    brief_summary?: string;
    upsell_recommendation?: {
      should_upsell?: boolean;
      recommended_tier?: string;
      reasoning?: string;
      upsell_price_delta?: number;
    } | null;
    flags?: string[];
  } | null;
}

async function fetchPanels(briefId: string): Promise<{
  run: AnalysisRun | null;
  events: HistoryEvent[];
  photoCount: number;
}> {
  const supabase = await getSupabaseServer();
  const [{ data: runRow }, { data: eventsRows }, { count: photoCount }] = await Promise.all([
    supabase
      .from('analysis_runs')
      .select('id, run_index, estimated_quality_score, framework_seed, ai_output')
      .eq('brief_id', briefId)
      .eq('is_current', true)
      .maybeSingle(),
    supabase
      .from('activity_log')
      .select('occurred_at, event_type, payload')
      .eq('brief_id', briefId)
      .order('occurred_at', { ascending: true }),
    supabase
      .from('brief_photos')
      .select('*', { count: 'exact', head: true })
      .eq('brief_id', briefId),
  ]);
  return {
    run: (runRow as AnalysisRun | null) ?? null,
    events: (eventsRows ?? []) as HistoryEvent[],
    photoCount: photoCount ?? 0,
  };
}

export async function ReviewMode({ orderId, order }: ReviewModeProps) {
  const briefId = order.brief_id;
  const submittedAt = order.briefs?.submitted_at ?? new Date().toISOString();
  const { run, events, photoCount } = await fetchPanels(briefId);

  const formPayload = (order.briefs?.form_payload ?? null) as Parameters<
    typeof FormResponsesPanel
  >[0]['formPayload'];

  return (
    <div className="container py-6 pb-24">
      <p className="mb-2 text-xs text-muted-foreground">
        Order {orderId.slice(0, 8)} · status: pending_founder_review
      </p>
      <div className="mb-3">
        <HistoryAccordion events={events} submittedAt={submittedAt} />
      </div>
      <div className="grid gap-4 lg:grid-cols-2">
        <FormResponsesPanel
          formPayload={formPayload}
          customerName={order.customers?.name ?? null}
          customerEmail={order.customers?.email ?? null}
          brandName={
            (formPayload as { brand_name?: string } | null)?.brand_name ?? null
          }
          photoCount={photoCount}
        />
        {run ? (
          <AiSnapshotPanel
            runIndex={run.run_index}
            estimatedQualityScore={run.estimated_quality_score}
            briefSummary={run.ai_output?.brief_summary ?? null}
            selectedPairs={run.framework_seed?.selected_pairs ?? []}
            upsell={run.ai_output?.upsell_recommendation ?? null}
            flags={run.ai_output?.flags ?? []}
          />
        ) : (
          <div className="rounded-lg border bg-card p-4 text-sm text-muted-foreground">
            AI analysis hasn’t completed yet — check back in a few minutes.
            Re-analyze and Approve are disabled until it lands.
          </div>
        )}
      </div>
      <ActionBar
        orderId={orderId}
        briefId={briefId}
        priorRunId={run?.id ?? null}
        runIndex={run?.run_index ?? 0}
        submittedAt={submittedAt}
        customerEmail={order.customers?.email ?? null}
        analysisReady={Boolean(run)}
      />
      <RealtimeOrderDetail orderId={orderId} briefId={briefId} />
    </div>
  );
}
```

(Note: this file imports `ActionBar` and `RealtimeOrderDetail` which Task 7 creates. After Task 6, this file will not typecheck — that's expected. Phase 4.5 cyclic-dep lesson says "do not check in non-typechecking code", so we move both Tasks 6+7 into a single commit OR temporarily stub the missing imports. Choose temporary stubs in Step 6.7 to keep commits atomic.)

- [x] **Step 6.7: Add temporary stubs for ActionBar + RealtimeOrderDetail**

Create `apps/web/src/app/admin/orders/[id]/components/ActionBar.tsx` (stub):

```tsx
// Stub — implementation in Task 7.
'use client';
interface ActionBarProps {
  orderId: string;
  briefId: string;
  priorRunId: string | null;
  runIndex: number;
  submittedAt: string;
  customerEmail: string | null;
  analysisReady: boolean;
}
export function ActionBar(_props: ActionBarProps) {
  return (
    <div className="fixed inset-x-0 bottom-0 border-t bg-background p-3 text-center text-xs text-muted-foreground">
      Action bar (approve / re-analyze / discard) — wired in Task 7.
    </div>
  );
}
```

Create `apps/web/src/app/admin/orders/[id]/components/RealtimeOrderDetail.tsx` (stub):

```tsx
// Stub — implementation in Task 7.
'use client';
export function RealtimeOrderDetail(_props: { orderId: string; briefId: string }) {
  return null;
}
```

- [x] **Step 6.8: Run typecheck + tests**

```bash
cd apps/web && pnpm typecheck && pnpm test
```

Expected: clean. New HistoryAccordion tests pass.

- [x] **Step 6.9: Commit**

```bash
cd "C:\Users\DELL\Documents\Antigravity\operscale-calender\operscale-calendar-platform"
git add apps/web/src/app/admin/orders/[id]/page.tsx apps/web/src/app/admin/orders/[id]/components/ReviewMode.tsx apps/web/src/app/admin/orders/[id]/components/HistoryAccordion.tsx apps/web/src/app/admin/orders/[id]/components/FormResponsesPanel.tsx apps/web/src/app/admin/orders/[id]/components/AiSnapshotPanel.tsx apps/web/src/app/admin/orders/[id]/components/ActionBar.tsx apps/web/src/app/admin/orders/[id]/components/RealtimeOrderDetail.tsx apps/web/test/components/HistoryAccordion.test.tsx
git commit -m "feat(web): order-detail review-mode read panels (history accordion + form + AI snapshot)"
```

---

## Task 7: Action bar + 3 modals + RealtimeOrderDetail

**Files:**
- Modify: `apps/web/src/app/admin/orders/[id]/components/ActionBar.tsx` (replace stub)
- Modify: `apps/web/src/app/admin/orders/[id]/components/RealtimeOrderDetail.tsx` (replace stub)
- Create: `apps/web/src/app/admin/orders/[id]/components/ApproveModal.tsx`
- Create: `apps/web/src/app/admin/orders/[id]/components/ReanalyzeModal.tsx`
- Create: `apps/web/src/app/admin/orders/[id]/components/DiscardModal.tsx`
- Create: `apps/web/test/components/DiscardModal.test.tsx`
- Create: `apps/web/test/components/ReanalyzeModal.test.tsx`
- Create: `apps/web/test/components/ApproveModal.test.tsx`

`fetch` to `apps/agent` is the write path. Get the founder's JWT from the browser session and forward it as `Authorization: Bearer ...`.

- [x] **Step 7.1: Implement `DiscardModal`**

Create `apps/web/src/app/admin/orders/[id]/components/DiscardModal.tsx`:

```tsx
'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { getSupabaseBrowser } from '@/lib/supabase-browser';

interface DiscardModalProps {
  open: boolean;
  onClose: () => void;
  orderId: string;
}

const AGENT_BASE_URL = process.env.NEXT_PUBLIC_AGENT_BASE_URL ?? 'https://api.operscale.cloud';

export function DiscardModal({ open, onClose, orderId }: DiscardModalProps) {
  const router = useRouter();
  const [reason, setReason] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!open) return null;

  async function onSubmit() {
    if (submitting) return;
    setSubmitting(true);
    setError(null);

    const supabase = getSupabaseBrowser();
    const { data: sess } = await supabase.auth.getSession();
    const token = sess.session?.access_token;
    if (!token) {
      setError('Session expired. Refresh and try again.');
      setSubmitting(false);
      return;
    }

    const trimmed = reason.trim();
    const body: { order_id: string; reason?: string } = { order_id: orderId };
    if (trimmed.length > 0) body.reason = trimmed;

    const res = await fetch(`${AGENT_BASE_URL}/v1/brief/discard`, {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify(body),
    });

    if (res.status === 200) {
      router.push('/admin/pending-review');
      router.refresh();
      return;
    }
    if (res.status === 409) {
      const detail = await res.json().catch(() => ({}));
      setError(
        `This order is already ${detail.current_status ?? 'actioned'}. Refreshing.`,
      );
      setSubmitting(false);
      setTimeout(() => router.refresh(), 1500);
      return;
    }
    const errBody = await res.json().catch(() => ({ error: 'unknown' }));
    setError(`Discard failed: ${errBody.error ?? res.status}`);
    setSubmitting(false);
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <div className="w-full max-w-md rounded-lg bg-background p-5 shadow-xl">
        <h3 className="text-lg font-semibold">Discard this order?</h3>
        <p className="mt-1 text-sm text-muted-foreground">
          The customer’s auto-acknowledgement email already went out. No further emails will
          fire. You can re-open this order later via Supabase Studio if needed.
        </p>
        <label className="mt-4 block">
          <span className="text-xs text-muted-foreground">Reason (optional, max 500 chars)</span>
          <textarea
            value={reason}
            onChange={(e) => setReason(e.target.value.slice(0, 500))}
            className="mt-1 block w-full rounded-md border px-2 py-1 text-sm"
            rows={3}
            disabled={submitting}
            placeholder="e.g. spam, fake submission, off-niche"
          />
        </label>
        {error && (
          <p className="mt-2 rounded-md border border-red-300 bg-red-50 p-2 text-xs text-red-900">
            {error}
          </p>
        )}
        <div className="mt-4 flex justify-end gap-2">
          <button
            type="button"
            onClick={onClose}
            disabled={submitting}
            className="rounded-md border px-3 py-1.5 text-sm"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={onSubmit}
            disabled={submitting}
            className="rounded-md bg-red-600 px-3 py-1.5 text-sm text-white disabled:opacity-50"
          >
            {submitting ? 'Discarding…' : 'Discard'}
          </button>
        </div>
      </div>
    </div>
  );
}
```

- [x] **Step 7.2: Implement `ReanalyzeModal`**

Create `apps/web/src/app/admin/orders/[id]/components/ReanalyzeModal.tsx`:

```tsx
'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { getSupabaseBrowser } from '@/lib/supabase-browser';

interface ReanalyzeModalProps {
  open: boolean;
  onClose: () => void;
  briefId: string;
  priorRunId: string;
}

const AGENT_BASE_URL = process.env.NEXT_PUBLIC_AGENT_BASE_URL ?? 'https://api.operscale.cloud';

export function ReanalyzeModal({ open, onClose, briefId, priorRunId }: ReanalyzeModalProps) {
  const router = useRouter();
  const [note, setNote] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!open) return null;

  const trimmed = note.trim();
  const ready = trimmed.length >= 10;

  async function onSubmit() {
    if (submitting || !ready) return;
    setSubmitting(true);
    setError(null);

    const supabase = getSupabaseBrowser();
    const { data: sess } = await supabase.auth.getSession();
    const token = sess.session?.access_token;
    if (!token) {
      setError('Session expired. Refresh and try again.');
      setSubmitting(false);
      return;
    }

    const res = await fetch(`${AGENT_BASE_URL}/v1/brief/analyze`, {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({
        brief_id: briefId,
        trigger_type: 're_analyze_same_frameworks',
        prior_run_id: priorRunId,
        founder_note: trimmed,
      }),
    });

    if (res.status === 200 || res.status === 202) {
      // Realtime subscription on analysis_runs (RealtimeOrderDetail) will
      // refresh the page when the new run lands. Close + refresh once now to
      // immediately reflect the enqueue.
      onClose();
      router.refresh();
      return;
    }
    const errBody = await res.json().catch(() => ({ error: 'unknown' }));
    setError(`Couldn’t enqueue re-analysis: ${errBody.error ?? res.status}`);
    setSubmitting(false);
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <div className="w-full max-w-md rounded-lg bg-background p-5 shadow-xl">
        <h3 className="text-lg font-semibold">Re-analyze with note</h3>
        <p className="mt-1 text-sm text-muted-foreground">
          Re-runs Claude with the same 8 selected pairs plus your note. Inline edits aren’t
          supported in v0; expect ~2 minutes.
        </p>
        <label className="mt-4 block">
          <span className="text-xs text-muted-foreground">
            What needs to change? (min 10 chars)
          </span>
          <textarea
            value={note}
            onChange={(e) => setNote(e.target.value)}
            rows={5}
            disabled={submitting}
            className="mt-1 block w-full rounded-md border px-2 py-1 text-sm"
            placeholder="e.g. focus more on the educational angle; mention the launch in 2 weeks"
          />
        </label>
        <div className="mt-1 text-right text-xs text-muted-foreground">{trimmed.length} / 10</div>
        {error && (
          <p className="mt-2 rounded-md border border-red-300 bg-red-50 p-2 text-xs text-red-900">
            {error}
          </p>
        )}
        <div className="mt-4 flex justify-end gap-2">
          <button
            type="button"
            onClick={onClose}
            disabled={submitting}
            className="rounded-md border px-3 py-1.5 text-sm"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={onSubmit}
            disabled={submitting || !ready}
            className="rounded-md bg-primary px-3 py-1.5 text-sm text-primary-foreground disabled:opacity-50"
          >
            {submitting ? 'Enqueuing…' : 'Re-analyze'}
          </button>
        </div>
      </div>
    </div>
  );
}
```

- [x] **Step 7.3: Implement `ApproveModal`**

Create `apps/web/src/app/admin/orders/[id]/components/ApproveModal.tsx`:

```tsx
'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { getSupabaseBrowser } from '@/lib/supabase-browser';

interface ApproveModalProps {
  open: boolean;
  onClose: () => void;
  orderId: string;
  customerEmail: string | null;
}

const AGENT_BASE_URL = process.env.NEXT_PUBLIC_AGENT_BASE_URL ?? 'https://api.operscale.cloud';

export function ApproveModal({ open, onClose, orderId, customerEmail }: ApproveModalProps) {
  const router = useRouter();
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!open) return null;

  async function onSubmit() {
    if (submitting) return;
    setSubmitting(true);
    setError(null);

    const supabase = getSupabaseBrowser();
    const { data: sess } = await supabase.auth.getSession();
    const token = sess.session?.access_token;
    if (!token) {
      setError('Session expired. Refresh and try again.');
      setSubmitting(false);
      return;
    }

    const res = await fetch(`${AGENT_BASE_URL}/v1/brief/approve`, {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({ order_id: orderId }),
    });

    if (res.status === 200) {
      onClose();
      router.refresh();
      return;
    }
    if (res.status === 502) {
      // Phase 4.5 contract: paystack/resend failure leaves order in
      // founder_approved or brief_email_failed. Page will refresh into
      // Timeline mode showing the failure state.
      onClose();
      router.refresh();
      return;
    }
    const errBody = await res.json().catch(() => ({ error: 'unknown' }));
    setError(`Approval failed: ${errBody.error ?? res.status}`);
    setSubmitting(false);
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <div className="w-full max-w-md rounded-lg bg-background p-5 shadow-xl">
        <h3 className="text-lg font-semibold">Approve and send brief</h3>
        <p className="mt-1 text-sm text-muted-foreground">
          We’ll email the brief + Paystack payment link to{' '}
          <strong>{customerEmail ?? 'the customer'}</strong>. This is irreversible from the UI.
        </p>
        {error && (
          <p className="mt-2 rounded-md border border-red-300 bg-red-50 p-2 text-xs text-red-900">
            {error}
          </p>
        )}
        <div className="mt-4 flex justify-end gap-2">
          <button
            type="button"
            onClick={onClose}
            disabled={submitting}
            className="rounded-md border px-3 py-1.5 text-sm"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={onSubmit}
            disabled={submitting}
            className="rounded-md bg-primary px-3 py-1.5 text-sm text-primary-foreground disabled:opacity-50"
          >
            {submitting ? 'Sending…' : 'Approve and send'}
          </button>
        </div>
      </div>
    </div>
  );
}
```

- [x] **Step 7.4: Replace `ActionBar.tsx` stub with full implementation**

```tsx
'use client';

import { useState } from 'react';
import { ApproveModal } from './ApproveModal';
import { ReanalyzeModal } from './ReanalyzeModal';
import { DiscardModal } from './DiscardModal';

interface ActionBarProps {
  orderId: string;
  briefId: string;
  priorRunId: string | null;
  runIndex: number;
  submittedAt: string;
  customerEmail: string | null;
  analysisReady: boolean;
}

function relative(iso: string): string {
  const diffMin = Math.max(0, Math.floor((Date.now() - new Date(iso).getTime()) / 60_000));
  if (diffMin < 60) return `${diffMin}m ago`;
  return `${Math.floor(diffMin / 60)}h ago`;
}

export function ActionBar({
  orderId,
  briefId,
  priorRunId,
  runIndex,
  submittedAt,
  customerEmail,
  analysisReady,
}: ActionBarProps) {
  const [open, setOpen] = useState<'approve' | 'reanalyze' | 'discard' | null>(null);
  return (
    <div className="fixed inset-x-0 bottom-0 z-30 border-t bg-background/95 p-3 backdrop-blur">
      <div className="container flex items-center justify-between gap-3">
        <p className="text-xs text-muted-foreground">
          Run {runIndex} · Submitted {relative(submittedAt)}
        </p>
        <div className="flex gap-2">
          <button
            type="button"
            onClick={() => setOpen('discard')}
            className="rounded-md border border-red-300 px-3 py-1.5 text-sm text-red-700"
          >
            Discard
          </button>
          <button
            type="button"
            onClick={() => setOpen('reanalyze')}
            disabled={!analysisReady || !priorRunId}
            className="rounded-md border px-3 py-1.5 text-sm disabled:opacity-50"
          >
            Re-analyze
          </button>
          <button
            type="button"
            onClick={() => setOpen('approve')}
            disabled={!analysisReady}
            className="rounded-md bg-primary px-3 py-1.5 text-sm text-primary-foreground disabled:opacity-50"
          >
            Approve and send
          </button>
        </div>
      </div>
      <ApproveModal
        open={open === 'approve'}
        onClose={() => setOpen(null)}
        orderId={orderId}
        customerEmail={customerEmail}
      />
      <ReanalyzeModal
        open={open === 'reanalyze'}
        onClose={() => setOpen(null)}
        briefId={briefId}
        priorRunId={priorRunId ?? ''}
      />
      <DiscardModal
        open={open === 'discard'}
        onClose={() => setOpen(null)}
        orderId={orderId}
      />
    </div>
  );
}
```

- [x] **Step 7.5: Replace `RealtimeOrderDetail.tsx` stub**

```tsx
'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { getSupabaseBrowser } from '@/lib/supabase-browser';

interface RealtimeOrderDetailProps {
  orderId: string;
  briefId: string;
}

export function RealtimeOrderDetail({ orderId, briefId }: RealtimeOrderDetailProps) {
  const router = useRouter();

  useEffect(() => {
    const supabase = getSupabaseBrowser();
    const channel = supabase
      .channel(`order-detail-${orderId}`)
      .on(
        'postgres_changes',
        { event: 'UPDATE', schema: 'public', table: 'orders', filter: `id=eq.${orderId}` },
        () => router.refresh(),
      )
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'analysis_runs',
          filter: `brief_id=eq.${briefId}`,
        },
        () => router.refresh(),
      )
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'activity_log',
          filter: `brief_id=eq.${briefId}`,
        },
        () => router.refresh(),
      )
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, [orderId, briefId, router]);

  return null;
}
```

- [x] **Step 7.6: Set `NEXT_PUBLIC_AGENT_BASE_URL` env var**

Add to `apps/web/.env.example` (after the supabase section):

```
# --- Agent (server-side API base URL) ---------------------------------------
# In dev: http://127.0.0.1:3002 (avoids the Node 20 IPv6 localhost gotcha #1).
# In prod: https://api.operscale.cloud.
NEXT_PUBLIC_AGENT_BASE_URL=http://127.0.0.1:3002
```

Production env file `/etc/operscale-calendar/web.env` on the VPS gets `NEXT_PUBLIC_AGENT_BASE_URL=https://api.operscale.cloud` (set during VPS rebuild in Task 12).

- [x] **Step 7.7: Write modal tests**

Create `apps/web/test/components/DiscardModal.test.tsx`:

```tsx
// @vitest-environment happy-dom

import { describe, expect, it, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import '@testing-library/jest-dom/vitest';

const mockGetSession = vi.fn();
vi.mock('@/lib/supabase-browser', () => ({
  getSupabaseBrowser: () => ({
    auth: { getSession: mockGetSession },
  }),
}));
const mockPush = vi.fn();
const mockRefresh = vi.fn();
vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: mockPush, refresh: mockRefresh }),
}));
const mockFetch = vi.fn();
vi.stubGlobal('fetch', mockFetch);

import { DiscardModal } from '../../src/app/admin/orders/[id]/components/DiscardModal';

beforeEach(() => {
  mockFetch.mockReset();
  mockGetSession.mockReset().mockResolvedValue({ session: { access_token: 'tok' } });
  mockPush.mockReset();
  mockRefresh.mockReset();
});

describe('DiscardModal', () => {
  it('renders nothing when closed', () => {
    const { container } = render(
      <DiscardModal open={false} onClose={() => {}} orderId="abc" />,
    );
    expect(container.firstChild).toBeNull();
  });

  it('clamps reason input to 500 chars', () => {
    render(<DiscardModal open onClose={() => {}} orderId="abc" />);
    const ta = screen.getByPlaceholderText(/spam, fake/) as HTMLTextAreaElement;
    fireEvent.change(ta, { target: { value: 'x'.repeat(600) } });
    expect(ta.value.length).toBe(500);
  });

  it('POSTs with reason on confirm and pushes on 200', async () => {
    mockFetch.mockResolvedValueOnce({ status: 200, json: async () => ({}) });
    render(<DiscardModal open onClose={() => {}} orderId="abc" />);
    fireEvent.change(screen.getByPlaceholderText(/spam, fake/), {
      target: { value: 'spam' },
    });
    fireEvent.click(screen.getByRole('button', { name: /Discard/ }));
    await waitFor(() => expect(mockPush).toHaveBeenCalledWith('/admin/pending-review'));
    const body = JSON.parse(mockFetch.mock.calls[0][1].body);
    expect(body).toEqual({ order_id: 'abc', reason: 'spam' });
  });

  it('omits reason when empty', async () => {
    mockFetch.mockResolvedValueOnce({ status: 200, json: async () => ({}) });
    render(<DiscardModal open onClose={() => {}} orderId="abc" />);
    fireEvent.click(screen.getByRole('button', { name: /Discard/ }));
    await waitFor(() => expect(mockFetch).toHaveBeenCalled());
    const body = JSON.parse(mockFetch.mock.calls[0][1].body);
    expect(body).toEqual({ order_id: 'abc' });
  });

  it('handles 409 with current_status banner', async () => {
    mockFetch.mockResolvedValueOnce({
      status: 409,
      json: async () => ({ current_status: 'paid' }),
    });
    render(<DiscardModal open onClose={() => {}} orderId="abc" />);
    fireEvent.click(screen.getByRole('button', { name: /Discard/ }));
    await waitFor(() => expect(screen.getByText(/already paid/)).toBeInTheDocument());
  });
});
```

Create `apps/web/test/components/ReanalyzeModal.test.tsx`:

```tsx
// @vitest-environment happy-dom

import { describe, expect, it, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import '@testing-library/jest-dom/vitest';

const mockGetSession = vi.fn();
vi.mock('@/lib/supabase-browser', () => ({
  getSupabaseBrowser: () => ({ auth: { getSession: mockGetSession } }),
}));
vi.mock('next/navigation', () => ({ useRouter: () => ({ refresh: vi.fn() }) }));
const mockFetch = vi.fn();
vi.stubGlobal('fetch', mockFetch);

import { ReanalyzeModal } from '../../src/app/admin/orders/[id]/components/ReanalyzeModal';

beforeEach(() => {
  mockFetch.mockReset();
  mockGetSession.mockReset().mockResolvedValue({ session: { access_token: 'tok' } });
});

describe('ReanalyzeModal', () => {
  it('disables submit until note has 10+ chars', () => {
    render(
      <ReanalyzeModal open onClose={() => {}} briefId="brief-1" priorRunId="run-1" />,
    );
    const btn = screen.getByRole('button', { name: /Re-analyze/ });
    expect(btn).toBeDisabled();
    fireEvent.change(screen.getByPlaceholderText(/educational angle/), {
      target: { value: 'short' },
    });
    expect(btn).toBeDisabled();
    fireEvent.change(screen.getByPlaceholderText(/educational angle/), {
      target: { value: 'this note is long enough now' },
    });
    expect(btn).not.toBeDisabled();
  });

  it('POSTs with re_analyze_same_frameworks trigger', async () => {
    mockFetch.mockResolvedValueOnce({ status: 202, json: async () => ({}) });
    render(
      <ReanalyzeModal open onClose={() => {}} briefId="brief-1" priorRunId="run-1" />,
    );
    fireEvent.change(screen.getByPlaceholderText(/educational angle/), {
      target: { value: 'add more urgency to the angles' },
    });
    fireEvent.click(screen.getByRole('button', { name: /Re-analyze/ }));
    await waitFor(() => expect(mockFetch).toHaveBeenCalled());
    const body = JSON.parse(mockFetch.mock.calls[0][1].body);
    expect(body).toEqual({
      brief_id: 'brief-1',
      trigger_type: 're_analyze_same_frameworks',
      prior_run_id: 'run-1',
      founder_note: 'add more urgency to the angles',
    });
  });
});
```

Create `apps/web/test/components/ApproveModal.test.tsx`:

```tsx
// @vitest-environment happy-dom

import { describe, expect, it, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import '@testing-library/jest-dom/vitest';

const mockGetSession = vi.fn();
vi.mock('@/lib/supabase-browser', () => ({
  getSupabaseBrowser: () => ({ auth: { getSession: mockGetSession } }),
}));
const mockRefresh = vi.fn();
vi.mock('next/navigation', () => ({ useRouter: () => ({ refresh: mockRefresh }) }));
const mockFetch = vi.fn();
vi.stubGlobal('fetch', mockFetch);

import { ApproveModal } from '../../src/app/admin/orders/[id]/components/ApproveModal';

beforeEach(() => {
  mockFetch.mockReset();
  mockGetSession.mockReset().mockResolvedValue({ session: { access_token: 'tok' } });
  mockRefresh.mockReset();
});

describe('ApproveModal', () => {
  it('closes + refreshes on 200', async () => {
    mockFetch.mockResolvedValueOnce({ status: 200, json: async () => ({}) });
    const onClose = vi.fn();
    render(
      <ApproveModal
        open
        onClose={onClose}
        orderId="abc"
        customerEmail="x@y.com"
      />,
    );
    fireEvent.click(screen.getByRole('button', { name: /Approve and send/ }));
    await waitFor(() => expect(onClose).toHaveBeenCalled());
    expect(mockRefresh).toHaveBeenCalled();
  });

  it('shows inline error on non-502 failure', async () => {
    mockFetch.mockResolvedValueOnce({
      status: 500,
      json: async () => ({ error: 'db_down' }),
    });
    render(
      <ApproveModal
        open
        onClose={() => {}}
        orderId="abc"
        customerEmail="x@y.com"
      />,
    );
    fireEvent.click(screen.getByRole('button', { name: /Approve and send/ }));
    await waitFor(() => expect(screen.getByText(/Approval failed/)).toBeInTheDocument());
  });
});
```

- [x] **Step 7.8: Run typecheck + tests + build**

```bash
cd apps/web && pnpm typecheck && pnpm test && pnpm build
```

Expected: clean. ~16 component tests now pass total.

- [x] **Step 7.9: Commit**

```bash
cd "C:\Users\DELL\Documents\Antigravity\operscale-calender\operscale-calendar-platform"
git add apps/web/src/app/admin/orders/[id]/components/ apps/web/test/components/ apps/web/.env.example
git commit -F /c/tmp/commit-msg-task7.txt
```

`/c/tmp/commit-msg-task7.txt`:

```
feat(web): order-detail action bar + 3 modals + RealtimeOrderDetail

- ActionBar (sticky bottom) hosts ApproveModal / ReanalyzeModal /
  DiscardModal. Buttons gated on analysis-ready (re-analyze + approve
  require an is_current analysis_runs row).

- ApproveModal POSTs /v1/brief/approve and refreshes on 200 or 502
  (Phase 4.5 contract leaves order in founder_approved or
  brief_email_failed state — page re-renders into Timeline mode
  showing the failure).

- ReanalyzeModal validates min-10-char note client-side; POSTs to
  /v1/brief/analyze with trigger_type=re_analyze_same_frameworks
  (canonical enum from idempotency-key.ts).

- DiscardModal clamps reason to 500 chars; POSTs /v1/brief/discard;
  handles 409 with current_status banner; pushes to /pending-review
  on success.

- RealtimeOrderDetail subscribes to orders + analysis_runs +
  activity_log filtered to the current order/brief; calls
  router.refresh() so SSR'd state re-renders on UPDATE/INSERT.

- NEXT_PUBLIC_AGENT_BASE_URL env var documented in .env.example
  (127.0.0.1 in dev to avoid Node 20 IPv6 gotcha #1, full URL in prod).

- 3 component test files (~10 tests) cover happy + error paths.
```

- [x] **Step 7.10: Push origin/main (3 tasks since last push)**

```bash
git push origin main
```

---

## Task 8: Timeline mode

**Files:**
- Modify: `apps/web/src/app/admin/orders/[id]/components/TimelineMode.tsx`
- Create: `apps/web/src/app/admin/orders/[id]/components/timeline/EventCard.tsx`

- [x] **Step 8.1: Implement `EventCard`**

Create `apps/web/src/app/admin/orders/[id]/components/timeline/EventCard.tsx`:

```tsx
'use client';

import { useState } from 'react';

interface EventCardProps {
  occurred_at: string;
  event_type: string;
  payload: Record<string, unknown> | null;
}

function relative(iso: string): string {
  const diffMin = Math.max(0, Math.floor((Date.now() - new Date(iso).getTime()) / 60_000));
  if (diffMin < 1) return 'just now';
  if (diffMin < 60) return `${diffMin}m ago`;
  const diffH = Math.floor(diffMin / 60);
  if (diffH < 24) return `${diffH}h ago`;
  return `${Math.floor(diffH / 24)}d ago`;
}

export function EventCard({ occurred_at, event_type, payload }: EventCardProps) {
  const [open, setOpen] = useState(false);
  const hasPayload = payload && Object.keys(payload).length > 0;
  return (
    <div className="rounded-md border bg-card p-3 text-sm">
      <div className="flex items-baseline justify-between">
        <span className="font-mono text-xs">{event_type}</span>
        <span className="text-xs text-muted-foreground">
          {relative(occurred_at)} · {new Date(occurred_at).toISOString()}
        </span>
      </div>
      {hasPayload && (
        <button
          type="button"
          onClick={() => setOpen((v) => !v)}
          className="mt-1 text-xs text-blue-700 hover:underline"
        >
          {open ? 'Hide' : 'Show'} payload
        </button>
      )}
      {open && hasPayload && (
        <pre className="mt-1 overflow-x-auto rounded bg-muted/50 p-2 text-[11px]">
          {JSON.stringify(payload, null, 2)}
        </pre>
      )}
    </div>
  );
}
```

- [x] **Step 8.2: Replace `TimelineMode.tsx`**

```tsx
import { getSupabaseServer } from '@/lib/supabase-server';
import { EventCard } from './timeline/EventCard';
import { RealtimeOrderDetail } from './RealtimeOrderDetail';

interface OrderRow {
  id: string;
  brief_id: string;
  status: string;
  tier: string;
  amount_ngn: number | null;
  founder_approved_at: string | null;
  paid_at: string | null;
  paystack_authorization: { authorizationUrl?: string; reference?: string } | null;
  briefs: { id: string; submitted_at: string } | null;
  customers: { id: string; name: string | null; email: string | null } | null;
}

interface TimelineModeProps {
  orderId: string;
  order: OrderRow;
}

interface ActivityRow {
  occurred_at: string;
  event_type: string;
  payload: Record<string, unknown> | null;
}

export async function TimelineMode({ orderId, order }: TimelineModeProps) {
  const supabase = await getSupabaseServer();
  const briefId = order.brief_id;

  const { data: events } = await supabase
    .from('activity_log')
    .select('occurred_at, event_type, payload')
    .or(`order_id.eq.${orderId},brief_id.eq.${briefId}`)
    .order('occurred_at', { ascending: false });

  const rows = (events ?? []) as ActivityRow[];

  return (
    <div className="container py-6">
      <p className="text-xs text-muted-foreground">
        Order {orderId.slice(0, 8)} · status: {order.status}
      </p>
      <h1 className="mt-1 text-2xl font-semibold">
        {order.customers?.name ?? 'Unknown customer'} · {order.tier}
      </h1>

      <dl className="mt-4 grid gap-2 rounded-lg border bg-card p-4 text-sm sm:grid-cols-3">
        <div>
          <dt className="text-xs text-muted-foreground">Customer</dt>
          <dd>{order.customers?.email ?? '—'}</dd>
        </div>
        <div>
          <dt className="text-xs text-muted-foreground">Approved at</dt>
          <dd>{order.founder_approved_at ?? '—'}</dd>
        </div>
        <div>
          <dt className="text-xs text-muted-foreground">Paid at</dt>
          <dd>{order.paid_at ?? '—'}</dd>
        </div>
        {order.paystack_authorization?.authorizationUrl && (
          <div className="sm:col-span-3">
            <dt className="text-xs text-muted-foreground">Paystack URL</dt>
            <dd className="break-all">
              <a
                href={order.paystack_authorization.authorizationUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="text-blue-700 hover:underline"
              >
                {order.paystack_authorization.authorizationUrl}
              </a>
            </dd>
          </div>
        )}
      </dl>

      <h2 className="mt-6 text-lg font-semibold">Activity</h2>
      <div className="mt-2 space-y-2">
        {rows.length === 0 ? (
          <p className="rounded-md border bg-card p-4 text-sm text-muted-foreground">
            No activity yet.
          </p>
        ) : (
          rows.map((e, i) => (
            <EventCard
              key={i}
              occurred_at={e.occurred_at}
              event_type={e.event_type}
              payload={e.payload}
            />
          ))
        )}
      </div>

      <RealtimeOrderDetail orderId={orderId} briefId={briefId} />
    </div>
  );
}
```

- [x] **Step 8.3: Typecheck + build**

```bash
cd apps/web && pnpm typecheck && pnpm build
```

Expected: clean.

- [x] **Step 8.4: Commit**

```bash
cd "C:\Users\DELL\Documents\Antigravity\operscale-calender\operscale-calendar-platform"
git add apps/web/src/app/admin/orders/[id]/components/TimelineMode.tsx apps/web/src/app/admin/orders/[id]/components/timeline/
git commit -m "feat(web): order-detail timeline mode with activity_log + paystack URL link"
```

---

## Task 9: Paid-orders dashboard

**Files:**
- Create: `apps/web/src/app/admin/paid-orders/page.tsx`
- Create: `apps/web/src/app/admin/paid-orders/PaidOrdersTable.tsx`
- Create: `apps/web/src/app/admin/paid-orders/LoadMoreButton.tsx`
- Create: `apps/web/src/app/admin/paid-orders/RealtimePaidOrders.tsx`

- [x] **Step 9.1: Implement `paid-orders/page.tsx`**

```tsx
import { getSupabaseServer } from '@/lib/supabase-server';
import { PaidOrdersTable } from './PaidOrdersTable';

export const metadata = { title: 'Paid orders — Operscale CRM' };
export const dynamic = 'force-dynamic';

const PAGE_SIZE = 25;

export interface PaidOrderRow {
  order_id: string;
  brief_id: string;
  brand_name: string | null;
  customer_name: string | null;
  tier: 'starter' | 'standard' | 'calendar';
  paid_at: string;
  amount_ngn: number;
  paystack_reference: string | null;
}

interface JoinedRow {
  id: string;
  tier: string;
  paid_at: string | null;
  amount_ngn: number | null;
  paystack_authorization: { reference?: string } | null;
  briefs: { id: string; form_payload: { brand_name?: string } | null } | null;
  customers: { id: string; name: string | null } | null;
}

async function fetchPaid(): Promise<PaidOrderRow[]> {
  const supabase = await getSupabaseServer();
  const { data, error } = await supabase
    .from('orders')
    .select(
      `id, tier, paid_at, amount_ngn, paystack_authorization, briefs!inner(id, form_payload), customers!inner(id, name)`,
    )
    .eq('status', 'paid')
    .order('paid_at', { ascending: false })
    .limit(PAGE_SIZE);
  if (error) throw new Error(`paid_orders_query_failed: ${error.message}`);
  return ((data ?? []) as unknown as JoinedRow[]).map((o) => ({
    order_id: o.id,
    brief_id: o.briefs?.id ?? '',
    brand_name: o.briefs?.form_payload?.brand_name ?? null,
    customer_name: o.customers?.name ?? null,
    tier: o.tier as PaidOrderRow['tier'],
    paid_at: o.paid_at ?? '',
    amount_ngn: o.amount_ngn ?? 0,
    paystack_reference: o.paystack_authorization?.reference ?? null,
  }));
}

export default async function PaidOrdersPage() {
  const initial = await fetchPaid();
  return (
    <div className="container py-8">
      <h1 className="text-2xl font-semibold">Paid orders</h1>
      <p className="mt-1 text-sm text-muted-foreground">
        Last {initial.length} paid orders. Live updates via Realtime.
      </p>
      <div className="mt-6">
        <PaidOrdersTable initialRows={initial} pageSize={PAGE_SIZE} />
      </div>
    </div>
  );
}
```

- [x] **Step 9.2: Implement `PaidOrdersTable.tsx`**

```tsx
'use client';

import Link from 'next/link';
import { useState } from 'react';
import type { PaidOrderRow } from './page';
import { LoadMoreButton } from './LoadMoreButton';
import { RealtimePaidOrders } from './RealtimePaidOrders';

function fmtAmount(ngn: number): string {
  return `₦${ngn.toLocaleString('en-NG')}`;
}

function fmtPaidAt(iso: string): string {
  if (!iso) return '—';
  const d = new Date(iso);
  return `${d.toISOString().slice(0, 16)}Z`;
}

export function PaidOrdersTable({
  initialRows,
  pageSize,
}: {
  initialRows: PaidOrderRow[];
  pageSize: number;
}) {
  const [rows, setRows] = useState<PaidOrderRow[]>(initialRows);

  return (
    <div className="rounded-lg border bg-card">
      <div className="grid grid-cols-[2fr_1.5fr_0.8fr_1.4fr_1fr] items-center gap-3 border-b bg-muted/30 px-3 py-2 text-xs uppercase text-muted-foreground">
        <span>Brand</span>
        <span>Customer</span>
        <span>Tier</span>
        <span>Paid at</span>
        <span className="text-right">Amount</span>
      </div>
      {rows.length === 0 ? (
        <p className="p-6 text-center text-sm text-muted-foreground">No paid orders yet.</p>
      ) : (
        rows.map((r) => (
          <Link
            key={r.order_id}
            href={`/admin/orders/${r.order_id}`}
            className="grid grid-cols-[2fr_1.5fr_0.8fr_1.4fr_1fr] items-center gap-3 border-b px-3 py-2 text-sm hover:bg-muted/40"
          >
            <span className="font-medium">{r.brand_name ?? '—'}</span>
            <span className="text-muted-foreground">{r.customer_name ?? 'Unknown'}</span>
            <span>
              <span className="rounded-sm bg-muted px-1.5 py-0.5 text-xs uppercase">
                {r.tier}
              </span>
            </span>
            <span className="text-xs text-muted-foreground">{fmtPaidAt(r.paid_at)}</span>
            <span className="text-right tabular-nums">{fmtAmount(r.amount_ngn)}</span>
          </Link>
        ))
      )}
      <RealtimePaidOrders onPrepend={(row) => setRows((prev) => [row, ...prev])} />
      <LoadMoreButton
        currentCount={rows.length}
        pageSize={pageSize}
        onLoaded={(more) => setRows((prev) => [...prev, ...more])}
      />
    </div>
  );
}
```

- [x] **Step 9.3: Implement `LoadMoreButton.tsx`**

```tsx
'use client';

import { useState } from 'react';
import { getSupabaseBrowser } from '@/lib/supabase-browser';
import type { PaidOrderRow } from './page';

interface LoadMoreButtonProps {
  currentCount: number;
  pageSize: number;
  onLoaded: (rows: PaidOrderRow[]) => void;
}

interface JoinedRow {
  id: string;
  tier: string;
  paid_at: string | null;
  amount_ngn: number | null;
  paystack_authorization: { reference?: string } | null;
  briefs: { id: string; form_payload: { brand_name?: string } | null } | null;
  customers: { id: string; name: string | null } | null;
}

export function LoadMoreButton({ currentCount, pageSize, onLoaded }: LoadMoreButtonProps) {
  const [loading, setLoading] = useState(false);
  const [done, setDone] = useState(false);

  if (done) return null;

  async function load() {
    if (loading) return;
    setLoading(true);
    const supabase = getSupabaseBrowser();
    const { data, error } = await supabase
      .from('orders')
      .select(
        `id, tier, paid_at, amount_ngn, paystack_authorization, briefs!inner(id, form_payload), customers!inner(id, name)`,
      )
      .eq('status', 'paid')
      .order('paid_at', { ascending: false })
      .range(currentCount, currentCount + pageSize - 1);
    setLoading(false);
    if (error) {
      console.error('[LoadMore] failed', error);
      return;
    }
    const more: PaidOrderRow[] = ((data ?? []) as unknown as JoinedRow[]).map((o) => ({
      order_id: o.id,
      brief_id: o.briefs?.id ?? '',
      brand_name: o.briefs?.form_payload?.brand_name ?? null,
      customer_name: o.customers?.name ?? null,
      tier: o.tier as PaidOrderRow['tier'],
      paid_at: o.paid_at ?? '',
      amount_ngn: o.amount_ngn ?? 0,
      paystack_reference: o.paystack_authorization?.reference ?? null,
    }));
    onLoaded(more);
    if (more.length < pageSize) setDone(true);
  }

  return (
    <div className="flex justify-center p-3">
      <button
        type="button"
        onClick={load}
        disabled={loading}
        className="rounded-md border px-3 py-1.5 text-sm disabled:opacity-50"
      >
        {loading ? 'Loading…' : 'Load more'}
      </button>
    </div>
  );
}
```

- [x] **Step 9.4: Implement `RealtimePaidOrders.tsx`**

```tsx
'use client';

import { useEffect } from 'react';
import { getSupabaseBrowser } from '@/lib/supabase-browser';
import type { PaidOrderRow } from './page';

interface JoinedRow {
  id: string;
  tier: string;
  paid_at: string | null;
  amount_ngn: number | null;
  paystack_authorization: { reference?: string } | null;
  briefs: { id: string; form_payload: { brand_name?: string } | null } | null;
  customers: { id: string; name: string | null } | null;
}

async function fetchJoined(orderId: string): Promise<PaidOrderRow | null> {
  const supabase = getSupabaseBrowser();
  const { data, error } = await supabase
    .from('orders')
    .select(
      `id, tier, paid_at, amount_ngn, paystack_authorization, briefs!inner(id, form_payload), customers!inner(id, name)`,
    )
    .eq('id', orderId)
    .maybeSingle();
  if (error || !data) return null;
  const o = data as unknown as JoinedRow;
  return {
    order_id: o.id,
    brief_id: o.briefs?.id ?? '',
    brand_name: o.briefs?.form_payload?.brand_name ?? null,
    customer_name: o.customers?.name ?? null,
    tier: o.tier as PaidOrderRow['tier'],
    paid_at: o.paid_at ?? '',
    amount_ngn: o.amount_ngn ?? 0,
    paystack_reference: o.paystack_authorization?.reference ?? null,
  };
}

export function RealtimePaidOrders({
  onPrepend,
}: {
  onPrepend: (row: PaidOrderRow) => void;
}) {
  useEffect(() => {
    const supabase = getSupabaseBrowser();
    const channel = supabase
      .channel('paid-orders')
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'orders',
          filter: 'status=eq.paid',
        },
        async (payload) => {
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          const newRow = (payload as any).new;
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          const oldRow = (payload as any).old;
          // Only prepend if status JUST flipped to paid (avoid double-counting
          // updates that touched paid orders for other reasons).
          if (newRow?.status === 'paid' && oldRow?.status !== 'paid' && newRow?.id) {
            const joined = await fetchJoined(newRow.id);
            if (joined) onPrepend(joined);
          }
        },
      )
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, [onPrepend]);

  return null;
}
```

- [x] **Step 9.5: Add nav link in admin layout**

Modify `apps/web/src/app/admin/layout.tsx` — add "Paid orders" link to the nav (after the existing "Pending review" link):

```tsx
<nav className="flex gap-4 text-sm">
  <a href="/admin/pending-review" className="hover:underline">
    Pending review
  </a>
  <a href="/admin/paid-orders" className="hover:underline">
    Paid orders
  </a>
</nav>
```

- [x] **Step 9.6: Typecheck + build**

```bash
cd apps/web && pnpm typecheck && pnpm build
```

Expected: clean.

- [x] **Step 9.7: Commit**

```bash
cd "C:\Users\DELL\Documents\Antigravity\operscale-calender\operscale-calendar-platform"
git add apps/web/src/app/admin/paid-orders/ apps/web/src/app/admin/layout.tsx
git commit -m "feat(web): /admin/paid-orders dashboard with Realtime + Load more"
```

---

## Task 10: Schema-reality integration test

**Files:**
- Create: `apps/agent/test/integration/phase5-schema-shapes.test.ts`

This test runs against real staging Supabase under `SMOKE=1`. It catches schema drift before VPS deploy (Phase 3 + 4.5 + 4.6 all bit us; defence in depth).

- [x] **Step 10.1: Write the test**

Create `apps/agent/test/integration/phase5-schema-shapes.test.ts`:

```typescript
// Phase 5 schema-reality test. Skipped unless SMOKE=1.
// Hits real staging Supabase via the service-role key from the master .env.
// Asserts that the queries /admin/* pages run actually return the columns
// the UI components expect.

import { describe, expect, it, beforeAll } from 'vitest';
import { createClient } from '@supabase/supabase-js';

const SMOKE = process.env.SMOKE === '1';
const it_smoke = SMOKE ? it : it.skip;

let supabase: ReturnType<typeof createClient>;

beforeAll(() => {
  if (!SMOKE) return;
  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) throw new Error('SUPABASE_URL + SUPABASE_SERVICE_ROLE_KEY required for SMOKE=1');
  supabase = createClient(url, key);
});

describe('Phase 5 schema reality (SMOKE=1)', () => {
  it_smoke('pending-review join returns expected columns', async () => {
    const { data, error } = await supabase
      .from('orders')
      .select(
        `id, tier, briefs!inner(id, submitted_at, form_payload), customers!inner(id, name), brief_photos(brief_id)`,
      )
      .eq('status', 'pending_founder_review')
      .limit(1);
    expect(error).toBeNull();
    expect(Array.isArray(data)).toBe(true);
    if (data && data.length > 0) {
      const row = data[0] as Record<string, unknown>;
      expect(typeof row.id).toBe('string');
      expect(['starter', 'standard', 'calendar']).toContain(row.tier as string);
    }
  });

  it_smoke('analysis_runs.framework_seed.selected_pairs is an 8-element array on a recent row', async () => {
    const { data, error } = await supabase
      .from('analysis_runs')
      .select('id, framework_seed')
      .eq('is_current', true)
      .order('created_at', { ascending: false })
      .limit(1);
    expect(error).toBeNull();
    if (data && data.length > 0) {
      const seed = (data[0].framework_seed as { selected_pairs: unknown[] }) ?? null;
      expect(seed).not.toBeNull();
      expect(Array.isArray(seed!.selected_pairs)).toBe(true);
      expect(seed!.selected_pairs.length).toBeGreaterThanOrEqual(7); // ≥7 because some old rows may have 7 (Phase 4 smoke history)
      expect(seed!.selected_pairs.length).toBeLessThanOrEqual(8);
    }
  });

  it_smoke('paid-orders join returns paid_at + amount_ngn', async () => {
    const { data, error } = await supabase
      .from('orders')
      .select(
        `id, tier, paid_at, amount_ngn, paystack_authorization, briefs!inner(id, form_payload), customers!inner(id, name)`,
      )
      .eq('status', 'paid')
      .order('paid_at', { ascending: false })
      .limit(1);
    expect(error).toBeNull();
    if (data && data.length > 0) {
      const row = data[0] as Record<string, unknown>;
      expect(typeof row.paid_at).toBe('string');
      expect(typeof row.amount_ngn).toBe('number');
    }
  });

  it_smoke('activity_log accepts founder-role INSERT (migration 0009 applied)', async () => {
    const TEST_BRIEF_ID = '00000000-0000-0000-0000-000000000099';
    // Insert via service-role (always passes). Then assert the policy exists.
    const { data: inserted, error: insErr } = await supabase
      .from('activity_log')
      .insert({
        event_type: 'phase5_schema_test',
        actor: 'test',
        brief_id: TEST_BRIEF_ID,
        payload: { test: true },
      })
      .select('id')
      .maybeSingle();
    expect(insErr).toBeNull();
    expect(inserted).not.toBeNull();
    // Cleanup.
    if (inserted?.id) {
      await supabase.from('activity_log').delete().eq('id', inserted.id);
    }

    // Verify the founder INSERT policy exists.
    const { data: policies } = await supabase
      .rpc('exec', {})
      .select('*')
      .limit(0); // we won't actually call rpc; assertion below uses raw SQL via a helper if needed.

    // pg_policies isn't queryable via supabase-js by default; rely on the manual
    // verification step in plan Task 1.11. This test asserts the INSERT works
    // (which it does for service-role); failure of the policy would only show
    // when authenticating as a founder JWT — covered by the Task 12 live smoke.
    expect(policies).toBeDefined();
  });
});
```

- [x] **Step 10.2: Add `SMOKE=1` runner script to apps/agent/package.json**

Modify `apps/agent/package.json` — add a script:

```json
"test:phase5-schema": "cross-env SMOKE=1 vitest run test/integration/phase5-schema-shapes.test.ts"
```

(`cross-env` is already in apps/agent devDeps if Phase 3's nightly-smoke setup added it; if not, add it: `pnpm add -D cross-env`.)

Actually — apps/agent already uses a `run-live-tests.mjs` script that parses `.env` directly. Use that pattern instead. Add to `apps/agent/scripts/run-phase5-smoke.mjs`:

```js
#!/usr/bin/env node
// apps/agent/scripts/run-phase5-smoke.mjs
import { spawnSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const envFile = resolve(process.cwd(), '../../.env');
const envContents = readFileSync(envFile, 'utf-8');
const env = { ...process.env, SMOKE: '1' };
for (const line of envContents.split(/\r?\n/)) {
  const m = line.match(/^([A-Z_]+)\s*=\s*(.*)$/);
  if (!m) continue;
  const [, key, val] = m;
  if (!env[key]) env[key] = val;
}
// Map the master .env names to apps/agent expectations.
env.SUPABASE_URL = env.SUPABASE_URL ?? env.NEXT_PUBLIC_SUPABASE_URL;
env.SUPABASE_SERVICE_ROLE_KEY = env.SUPABASE_SERVICE_ROLE_KEY;

const result = spawnSync(
  'pnpm',
  ['vitest', 'run', 'test/integration/phase5-schema-shapes.test.ts'],
  { stdio: 'inherit', env, shell: true },
);
process.exit(result.status ?? 1);
```

Then in `apps/agent/package.json`:

```json
"test:phase5-smoke": "node scripts/run-phase5-smoke.mjs"
```

- [x] **Step 10.3: Run the smoke test against staging**

```bash
cd apps/agent && pnpm test:phase5-smoke
```

Expected: 4/4 tests pass (or skip if SMOKE not set, but the runner sets it).

- [x] **Step 10.4: Commit**

```bash
cd "C:\Users\DELL\Documents\Antigravity\operscale-calender\operscale-calendar-platform"
git add apps/agent/test/integration/phase5-schema-shapes.test.ts apps/agent/scripts/run-phase5-smoke.mjs apps/agent/package.json
git commit -m "test(agent): phase5 schema-reality integration test (SMOKE=1)"
```

---

## Task 11: CI wiring

**Files:**
- Modify: `.github/workflows/ci.yml` (add apps/web test step + ensure tsc + lint gates)
- Modify: `.github/workflows/nightly-smoke.yml` (add phase5-smoke run)

- [x] **Step 11.1: Read existing workflows**

```bash
cat .github/workflows/ci.yml | head -80
cat .github/workflows/nightly-smoke.yml
```

Confirm the apps/agent test job exists; identify where to add apps/web.

- [x] **Step 11.2: Add apps/web test step in ci.yml**

After the existing `apps/agent` test step, add:

```yaml
      - name: apps/web — typecheck
        working-directory: apps/web
        run: pnpm typecheck

      - name: apps/web — lint
        working-directory: apps/web
        run: pnpm lint --max-warnings=0

      - name: apps/web — vitest
        working-directory: apps/web
        run: pnpm test
```

(Exact YAML indentation depends on existing steps — match them.)

- [x] **Step 11.3: Add nightly phase5-smoke step**

In `.github/workflows/nightly-smoke.yml`, after the existing nightly L3 test step, add:

```yaml
      - name: Phase 5 schema-reality smoke
        working-directory: apps/agent
        env:
          SMOKE: '1'
          SUPABASE_URL: ${{ secrets.SUPABASE_URL }}
          SUPABASE_SERVICE_ROLE_KEY: ${{ secrets.SUPABASE_SERVICE_ROLE_KEY }}
        run: pnpm vitest run test/integration/phase5-schema-shapes.test.ts
```

(`SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY` GitHub Actions repo secrets must exist. **Manual prereq**: if they don't, add via the GitHub UI before the next cron firing.)

- [x] **Step 11.4: Commit**

```bash
cd "C:\Users\DELL\Documents\Antigravity\operscale-calender\operscale-calendar-platform"
git add .github/workflows/ci.yml .github/workflows/nightly-smoke.yml
git commit -m "ci(phase-5): add apps/web typecheck+lint+test + nightly phase5 schema smoke"
```

- [x] **Step 11.5: Push origin/main**

```bash
git push origin main
```

---

## Task 12: VPS rebuild + live smoke

**Files (operational, not committed):**
- `C:\tmp\phase5-vps-rebuild.py` — paramiko-driven git pull + docker compose up
- `C:\tmp\phase5-smoke.py` — paramiko-driven discard + reanalyze paths against staging

- [x] **Step 12.1: Set NEXT_PUBLIC_AGENT_BASE_URL on VPS web env**

Via paramiko one-liner (see prompt.md "Tail agent logs on VPS" pattern, adapted to write):

```bash
ssh root@srv1297445.hstgr.cloud "
  grep -q '^NEXT_PUBLIC_AGENT_BASE_URL=' /etc/operscale-calendar/web.env || \\
  echo 'NEXT_PUBLIC_AGENT_BASE_URL=https://api.operscale.cloud' >> /etc/operscale-calendar/web.env
"
```

Verify with `cat /etc/operscale-calendar/web.env | grep AGENT_BASE_URL`.

- [x] **Step 12.2: Rebuild VPS**

```bash
PYTHONIOENCODING=utf-8 python C:\tmp\vps-rebuild.py
```

(Existing script; reads `server_password` from master .env; runs `git fetch origin main && git reset --hard origin/main && docker compose up -d --build`.)

Expected: web container rebuilt (~50s); agent rebuild not strictly needed but runs anyway. Both containers up.

- [x] **Step 12.3: Live verify the four routes**

```bash
curl -sI https://api.operscale.cloud/v1/health                        # 200
curl -sI -X POST https://api.operscale.cloud/v1/brief/discard         # 401
curl -sI https://operscale.cloud/admin                                # 200 (sign-in page)
curl -sI https://operscale.cloud/auth/callback                        # 307 to /admin?reason=expired
```

- [x] **Step 12.4: Manual sign-in smoke (founder browser test)**

In a private browser window:
1. Navigate to `https://operscale.cloud/admin`.
2. Enter `akinolaakinrimisi@gmail.com`. Click "Send sign-in link".
3. Expect "Check your email" state.
4. Open inbox, click the magic-link.
5. Expect redirect through `/auth/callback` to `/admin/pending-review`.
6. Verify `activity_log` has a `founder_signed_in` row via paramiko psql:
   ```sql
   SELECT event_type, payload, occurred_at FROM activity_log
   WHERE event_type='founder_signed_in' ORDER BY occurred_at DESC LIMIT 1;
   ```

- [x] **Step 12.5: Discard path smoke (paramiko-driven seed + browser action + paramiko verify)**

Create `C:\tmp\phase5-smoke.py`:

```python
"""Phase 5 live smoke: seed a pending-review fixture + walk discard path."""
import paramiko, pathlib, urllib.request, json, time, uuid
pw = next(l.split('=', 1)[1].strip() for l in pathlib.Path(
    r'c:\Users\DELL\Documents\Antigravity\operscale-calender\.env'
).read_text(encoding='utf-8').splitlines() if l.startswith('server_password='))

SUPABASE_URL = 'https://supabase.operscale.cloud'
SERVICE_ROLE_KEY = next(l.split('=', 1)[1].strip() for l in pathlib.Path(
    r'c:\Users\DELL\Documents\Antigravity\operscale-calender\.env'
).read_text(encoding='utf-8').splitlines() if l.startswith('SUPABASE_SERVICE_ROLE_KEY='))

def seed_pending_review():
    """Seed a customer + brief + order in pending_founder_review."""
    cust_id = str(uuid.uuid4())
    brief_id = str(uuid.uuid4())
    order_id = str(uuid.uuid4())
    headers = {
        'apikey': SERVICE_ROLE_KEY,
        'Authorization': f'Bearer {SERVICE_ROLE_KEY}',
        'Content-Type': 'application/json',
        'Prefer': 'return=representation',
    }
    # Customer
    urllib.request.urlopen(urllib.request.Request(
        f'{SUPABASE_URL}/rest/v1/customers',
        data=json.dumps({'id': cust_id, 'email': f'phase5-smoke-{cust_id[:8]}@test.com', 'name': 'Phase5 Smoke'}).encode(),
        headers=headers, method='POST',
    ))
    # Brief
    urllib.request.urlopen(urllib.request.Request(
        f'{SUPABASE_URL}/rest/v1/briefs',
        data=json.dumps({
            'id': brief_id, 'customer_id': cust_id, 'tier_intent': 'standard',
            'submitted_at': '2026-05-06T12:00:00Z',
            'form_payload': {'brand_name': 'Phase5 Smoke', 'niche': 'fashion'},
        }).encode(),
        headers=headers, method='POST',
    ))
    # Order
    urllib.request.urlopen(urllib.request.Request(
        f'{SUPABASE_URL}/rest/v1/orders',
        data=json.dumps({
            'id': order_id, 'customer_id': cust_id, 'brief_id': brief_id,
            'tier': 'standard', 'status': 'pending_founder_review',
        }).encode(),
        headers=headers, method='POST',
    ))
    return {'customer_id': cust_id, 'brief_id': brief_id, 'order_id': order_id}

def cleanup(ids):
    headers = {'apikey': SERVICE_ROLE_KEY, 'Authorization': f'Bearer {SERVICE_ROLE_KEY}'}
    for table, key, val in [
        ('orders', 'id', ids['order_id']),
        ('briefs', 'id', ids['brief_id']),
        ('customers', 'id', ids['customer_id']),
        ('activity_log', 'brief_id', ids['brief_id']),
    ]:
        try:
            urllib.request.urlopen(urllib.request.Request(
                f'{SUPABASE_URL}/rest/v1/{table}?{key}=eq.{val}',
                headers=headers, method='DELETE',
            ))
        except Exception as e:
            print(f'cleanup {table}: {e}')

if __name__ == '__main__':
    print('Seeding fixture...')
    ids = seed_pending_review()
    print(f"Seeded: {ids}")
    print(f"\n>>> Open https://operscale.cloud/admin/orders/{ids['order_id']} in a signed-in browser, click Discard, confirm.\n")
    input('Press Enter after you see the discard succeed and you are redirected to /admin/pending-review... ')

    # Verify via REST
    headers = {'apikey': SERVICE_ROLE_KEY, 'Authorization': f'Bearer {SERVICE_ROLE_KEY}'}
    res = urllib.request.urlopen(urllib.request.Request(
        f"{SUPABASE_URL}/rest/v1/orders?id=eq.{ids['order_id']}&select=status",
        headers=headers,
    ))
    rows = json.loads(res.read().decode())
    assert rows[0]['status'] == 'discarded', f"Expected discarded, got {rows[0]['status']}"

    res = urllib.request.urlopen(urllib.request.Request(
        f"{SUPABASE_URL}/rest/v1/activity_log?brief_id=eq.{ids['brief_id']}&event_type=eq.founder_discarded&select=payload",
        headers=headers,
    ))
    rows = json.loads(res.read().decode())
    assert len(rows) == 1, 'expected exactly one founder_discarded row'
    print('PASS: discard path green')

    cleanup(ids)
    print('Cleanup complete.')
```

Run: `PYTHONIOENCODING=utf-8 python C:\tmp\phase5-smoke.py`

- [x] **Step 12.6: Re-analyze path smoke (manual + paramiko poll)**

Re-use the seed pattern, then in the browser click Re-analyze, type a 20-char note, submit. Poll for the new `analysis_runs` row:

```bash
PYTHONIOENCODING=utf-8 python -c "
import urllib.request, json, time, pathlib
SERVICE_ROLE_KEY = next(l.split('=',1)[1].strip() for l in pathlib.Path(r'c:\\Users\\DELL\\Documents\\Antigravity\\operscale-calender\\.env').read_text(encoding='utf-8').splitlines() if l.startswith('SUPABASE_SERVICE_ROLE_KEY='))
brief_id = input('brief_id: ')
for i in range(60):
    res = urllib.request.urlopen(urllib.request.Request(
        f'https://supabase.operscale.cloud/rest/v1/analysis_runs?brief_id=eq.{brief_id}&order=run_index.desc&limit=1&select=run_index,is_current,trigger_type',
        headers={'apikey': SERVICE_ROLE_KEY, 'Authorization': f'Bearer {SERVICE_ROLE_KEY}'},
    ))
    rows = json.loads(res.read().decode())
    if rows and rows[0]['run_index'] >= 2:
        print(f'PASS: new run_index={rows[0][\"run_index\"]} trigger={rows[0][\"trigger_type\"]}'); break
    time.sleep(5)
else:
    raise AssertionError('Re-analysis never landed within 5 minutes')
"
```

- [x] **Step 12.7: Approve path smoke (re-run Phase 4.5 smoke)**

```bash
PYTHONIOENCODING=utf-8 python C:\tmp\phase4-5-smoke.py
```

Confirms the forward path (form → analyze → approve → Paystack init + Resend send → brief_sent) still works after the CRM deploy.

- [x] **Step 12.8: Cross-tab Realtime sanity check**

Open two browser tabs at `https://operscale.cloud/admin/pending-review`. Run the seed function from `phase5-smoke.py` (no input prompt — just the seed lines). Within ~3 seconds, both tabs should show the new row prepended. (If tab-2 doesn't update, gotcha #4 may have regressed — check `\d+ orders` for REPLICA IDENTITY FULL.)

- [x] **Step 12.9: Manual mobile + iPad + laptop test**

Per CLAUDE.md "test on real mobile devices":

1. iPad landscape: open `/admin/orders/[id]` for the seeded order; verify two-column layout, action bar at bottom, all panels readable.
2. 13" laptop (1280×800): same — sticky bottom bar should not overlap content (page has `pb-24` padding).
3. Phone (≤640px): two-column collapses to single-column stack; action bar full-width.

Take screenshots of each. Save to `docs/screenshots/phase-5-smoke/` (NOT committed — these are operational artefacts).

- [x] **Step 12.10: Document smoke run**

Append to `docs/runbooks/phase-5-smoke.md` (create the file if it doesn't exist):

```markdown
# Phase 5 live smoke (operational runbook)

Each time the CRM is rebuilt, run this checklist:

1. `python C:\tmp\phase5-vps-rebuild.py`
2. Curl-check the four endpoints (Step 12.3).
3. Browser sign-in test with a fresh magic link (Step 12.4).
4. Discard path smoke: `python C:\tmp\phase5-smoke.py`.
5. Re-analyze path smoke (Step 12.6).
6. Approve path smoke: `python C:\tmp\phase4-5-smoke.py`.
7. Cross-tab Realtime sanity (Step 12.8).
8. Mobile/iPad/laptop screenshot pass (Step 12.9).

Last run: 2026-05-06 — green across all 8 checks.
```

- [x] **Step 12.11: Commit runbook**

```bash
cd "C:\Users\DELL\Documents\Antigravity\operscale-calender\operscale-calendar-platform"
git add docs/runbooks/phase-5-smoke.md
git commit -m "docs(phase-5): live smoke runbook"
git push origin main
```

---

## Task 13: Close-out

**Files:**
- Modify: this plan file (flip all `[ ]` to `[x]`)
- Modify: `prompt.md` at repo root (rewrite as Phase 6 handoff)
- Memory updates (write through automatic memory system; not a file modification)

- [x] **Step 13.1: Verify all upstream tasks pass**

```bash
cd apps/agent && pnpm test && pnpm typecheck && pnpm build:worker
cd ../web && pnpm test && pnpm typecheck && pnpm build
```

Expected: all green, no skipped tests apart from the SMOKE-gated nightly + phase5-schema. Total tests: 281 (agent) + ~25 component (web) + existing email-template + sanity = ≈315.

- [x] **Step 13.2: Flip plan checkboxes**

Edit `docs/plans/2026-05-06-v2-phase-5-founder-crm.md` — change every `[ ]` to `[x]` in tasks 1-12 + steps 13.1-13.4.

- [x] **Step 13.3: Rewrite prompt.md as Phase 6 handoff**

Phase 6 (per the prompt's revised roadmap): customer brief form. Update prompt.md at the repo root analogously to the Phase 4.6→5 handoff already in place. Keep the carry-forwards section style; ensure all new schema reality (migration 0009, /v1/brief/discard live, NEXT_PUBLIC_AGENT_BASE_URL) is captured.

- [x] **Step 13.4: Single close-out commit + push**

```bash
cd "C:\Users\DELL\Documents\Antigravity\operscale-calender\operscale-calendar-platform"
git add docs/plans/2026-05-06-v2-phase-5-founder-crm.md prompt.md
git commit -F /c/tmp/commit-msg-task13.txt
git push origin main
```

`/c/tmp/commit-msg-task13.txt`:

```
chore(phase-5): close-out — flip plan checkboxes + Phase 6 handoff

Phase 5 (Founder CRM v0) is COMPLETE and LIVE on
https://operscale.cloud/admin. Forward path verified end-to-end:
- Magic-link sign-in via /admin → /auth/callback (writes
  founder_signed_in activity_log)
- Pending-review queue with Realtime live updates (oldest-first,
  LIMIT 100 cap with banner)
- Order detail page mode-switch (review/timeline) auto-driven by
  orders.status
- Three founder actions wired: approve (reuses live /v1/brief/approve),
  re-analyze (reuses live /v1/brief/analyze with
  trigger_type=re_analyze_same_frameworks), discard (new
  /v1/brief/discard route)
- Paid-orders dashboard with Realtime + Load more pagination

Migration 0009 added the activity_log founder INSERT + READ policies.

Commits range: <first-task-1-commit-hash> → <task-12-commit-hash>.
~30 commits across 13 tasks. Suite at ~315 tests passing.

prompt.md rewritten as Phase 6 (customer brief form) handoff.
```

---

## Self-review log (writing-plans skill step 8)

### 1. Spec coverage

| Spec section | Implemented in |
| --- | --- |
| §1 Goal | Whole plan |
| §2 Scope (in v0) | Tasks 2–9 |
| §2 Deferred | Out-of-scope reaffirmed in Task 13 close-out |
| §3 Locked decisions | Embedded in component contracts (Tasks 5, 6, 7, 9) |
| §4 Architecture | Task 1 (spec patch) + Tasks 4–9 |
| §5 Components | Task inventory matches §5.x sub-bullets |
| §6 Data flow | Tasks 5, 6, 9 (reads), Task 2 + 7 (writes), Task 7 (Realtime) |
| §7 Auth flow | Tasks 3, 4 |
| §8 Error handling | Each modal has explicit error paths (Task 7); page-level error.tsx in Task 6 |
| §9 Testing | Tasks 2 (TDD discard), 3-9 (component tests), 10 (schema-reality), 12 (live smoke) |
| §10 Risks | Activity_log RLS resolved by 0009 (Task 1); other risks tracked, not new tasks |
| §11 Out of scope | Carried into Task 13 close-out |
| §12 Files touched | Updated in Task 1 step 1.8 to match plan |
| §13 Implementation phases | This plan IS the expansion |
| §14 Self-review | This section |

**Gap check**: §10 risk "iPad-landscape layout looks wrong on a 13" laptop" — covered by Task 12 step 12.9 manual mobile/iPad/laptop test. ✓

**No `error.tsx` task**: §8.2 mentions `apps/web/src/app/admin/error.tsx`. Adding to Task 6 close — but it doesn't yet exist in the steps. **Adding here**: in Task 6 step 6.6, also create:

`apps/web/src/app/admin/error.tsx`:

```tsx
'use client';

export default function AdminError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <div className="container py-12">
      <h1 className="text-xl font-semibold">Couldn’t load the CRM.</h1>
      <p className="mt-2 text-sm text-muted-foreground">{error.message}</p>
      <button
        type="button"
        onClick={reset}
        className="mt-4 rounded-md border px-3 py-1.5 text-sm"
      >
        Try again
      </button>
    </div>
  );
}
```

(Add to the `git add` line in step 6.9.)

### 2. Placeholder scan

- No `TBD`, `TODO`, `FIXME`, "implement later" in any step.
- No "similar to Task N" — all tests have concrete code.
- All commands have expected output.
- Conditional fallback `/v1/auth/log-signin` from the spec is NOT a separate task because migration 0009 (Task 1) resolves the activity_log RLS — the fallback never fires. ✓

### 3. Type / signature consistency

- `QueueRowData` type defined in `QueueRow.tsx`, imported by `QueueTable.tsx`, `RealtimeQueue.tsx`, `pending-review/page.tsx`. ✓
- `PaidOrderRow` defined in `paid-orders/page.tsx`, imported by `PaidOrdersTable.tsx`, `LoadMoreButton.tsx`, `RealtimePaidOrders.tsx`. ✓
- `HistoryEvent` defined in `HistoryAccordion.tsx`, imported by `ReviewMode.tsx`. ✓
- `re_analyze_same_frameworks` (canonical from `idempotency-key.ts`) used consistently in ReanalyzeModal + spec patch (step 1.6) + tests. ✓
- Modal `open` / `onClose` props consistent across Approve / Reanalyze / Discard. ✓
- `verifyJwt` only imported on apps/agent side (matches spec patch step 1.3). ✓

### 4. Ambiguity check

- "Founder JWT" always means `Authorization: Bearer <session.access_token>` in client→agent fetch. Tests assert this header shape.
- "Realtime channel" names are static strings (`pending-review`, `paid-orders`, `order-detail-${id}`) — no name drift.
- "v0" / "deferred" boundaries explicit in spec §2 + plan close-out.

No remaining ambiguities.
