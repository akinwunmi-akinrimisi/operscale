# Phase 5 Founder CRM — Live Smoke Runbook

Each time the CRM is rebuilt on the VPS, run this checklist. The CRM at
`https://operscale.cloud/admin` is the founder's primary work surface;
smoke-testing protects it.

## Prerequisites

- VPS rebuilt + `docker ps` shows `operscale-calendar-web` and
  `operscale-calendar-agent` both `Up`.
- All migrations 0001-0010 applied to staging Supabase.
- Master `.env` at `C:\Users\DELL\Documents\Antigravity\operscale-calender\.env`
  contains valid `server_password` and `SUPABASE_SERVICE_ROLE_KEY`.
- `C:\tmp\phase4-5-smoke.py` available for the approve-path re-run.

## 1. Baseline endpoints (automatable)

```bash
curl -sI https://api.operscale.cloud/v1/health                        # -> 200
curl -sI -X POST https://api.operscale.cloud/v1/brief/discard         # -> 401
curl -sI https://operscale.cloud/admin                                # -> 200
curl -sI https://operscale.cloud/auth/callback                        # -> 307 to /admin?reason=expired
```

All four must pass before continuing.

> **Known concern (2026-05-06)**: `/auth/callback` returns 307 with
> `Location: https://0.0.0.0:3001/admin?reason=expired`. The path/query
> are correct; the host portion is wrong because the upstream Next.js
> server doesn't trust the proxy headers. Browser-driven flow works in
> practice (the magic-link redirect chain rewrites correctly through
> Supabase's redirectTo), but if sign-in lands on a `0.0.0.0:3001` URL,
> file an issue against `apps/web/src/app/auth/callback/route.ts` and
> set `NEXT_PUBLIC_SITE_URL` / X-Forwarded-Host trust.

## 2. Sign-in path (manual, magic link)

In a private browser window:

1. Navigate to `https://operscale.cloud/admin`.
2. Enter `akinolaakinrimisi@gmail.com`. Click "Send sign-in link".
3. Verify "Check your email" state with the email visible.
4. Open inbox, click the magic link.
5. Verify redirect through `/auth/callback` lands on `/admin/pending-review`.
6. Verify `activity_log` has a `founder_signed_in` row via paramiko psql:

   ```sql
   SELECT event_type, payload->>'actor_email' as email, occurred_at
   FROM activity_log
   WHERE event_type='founder_signed_in'
   ORDER BY occurred_at DESC LIMIT 1;
   ```

   Expected: row with email `akinolaakinrimisi@gmail.com` from the last
   few minutes.

## 3. Pending-review queue (manual)

While signed in:

1. `/admin/pending-review` shows the queue. If non-empty, verify each
   row shows brand_name, customer name (from `customers.full_name`),
   tier badge, niche, time-since-submission badge, and (optionally) a
   camera glyph for briefs with photos.
2. Verify oldest-first sort.
3. If a brief has been pending >2h, the badge is red. <=30m green. Else amber.

## 4. Discard path (manual + paramiko verify)

Pre-seed a fixture brief: use `C:\tmp\phase5-smoke.py` (template in
`docs/plans/2026-05-06-v2-phase-5-founder-crm.md` Task 12 step 12.5).
Paramiko inserts a customer + brief + order in `pending_founder_review`.

In the browser:

1. Navigate to `/admin/orders/<seeded-order-id>`. Verify Review mode
   renders (two-column form + AI snapshot, sticky bottom action bar
   with Discard / Re-analyze / Approve buttons).
2. Click "Discard" -> modal appears with optional reason textarea.
3. Type a 5-char reason, click "Discard".
4. Verify redirect to `/admin/pending-review`. Verify the discarded
   order is GONE from the queue.

Paramiko-verify:

```sql
SELECT status FROM orders WHERE id = '<seeded-order-id>';
-- Expected: discarded

SELECT event_type, payload->>'reason' AS reason FROM activity_log
WHERE event_type='founder_discarded'
  AND payload->>'order_id' = '<seeded-order-id>';
-- Expected: one row with reason='spam' (or whatever you typed)
```

Cleanup: delete the seeded customer + brief + order + activity_log rows.

## 5. Re-analyze path (manual + paramiko poll)

Seed another `pending_founder_review` fixture. Open it in the browser.

1. Click "Re-analyze with note" -> modal.
2. Type a 20-char note (min 10 chars enforced).
3. Click "Re-analyze". Modal should close.

Paramiko-poll for the new `analysis_runs` row:

```bash
PYTHONIOENCODING=utf-8 python -c "
import urllib.request, json, time, pathlib
SERVICE_ROLE_KEY = next(l.split('=',1)[1].strip() for l in pathlib.Path(r'c:\Users\DELL\Documents\Antigravity\operscale-calender\.env').read_text(encoding='utf-8').splitlines() if l.startswith('SUPABASE_SERVICE_ROLE_KEY='))
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

Expected: `run_index >= 2` with `trigger_type='re_analyze_same_frameworks'`
within ~3 minutes.

Cleanup the seeded order.

## 6. Approve path (re-run Phase 4.5 smoke)

```bash
PYTHONIOENCODING=utf-8 python C:\tmp\phase4-5-smoke.py
```

This exercises the existing forward path (form -> analyze -> approve ->
Paystack init + Resend brief email -> brief_sent). Confirms nothing in
Phase 5's CRM build broke the production path.

## 7. Cross-tab Realtime (manual)

1. Open two browser tabs at `https://operscale.cloud/admin/pending-review`.
2. In a third terminal, paramiko-insert a fixture `pending_founder_review`
   order (just the seed step from `phase5-smoke.py`, skipping the input
   prompt).
3. Both tabs should show the new row prepended within ~3 seconds.

If tab 2 doesn't update:

- Check `\d+ orders` in psql for `Replica Identity: FULL`.
- Check supabase-realtime container logs for subscribe errors.

## 8. Mobile + iPad + laptop visual check (manual)

Per CLAUDE.md "test on real mobile devices":

1. iPad landscape: open `/admin/orders/<seeded-pending-order>`. Verify
   two-column layout with sticky bottom action bar. All panels readable.
2. 13" laptop (1280x800): same — sticky bottom bar should not overlap
   content (page has `pb-24` padding).
3. Phone (<=640px): two-column collapses to single-column stack; action
   bar full-width.

Take screenshots; save to `docs/screenshots/phase-5-smoke/<date>/`
(NOT committed).

## 9. Sign-out

Click the sign-out button (in admin layout header, if implemented) ->
redirect to `/admin`. Verify `activity_log` does NOT have a
`founder_signed_out` event (we don't track sign-outs in v0).

## Last run

- 2026-05-06: VPS rebuild PASS (HEAD `6f62b0c`); baseline curl-checks
  PASS (steps 1 only — manual founder steps deferred to operator).
  Noted: `/auth/callback` Location host shows `0.0.0.0:3001` — see
  Section 1 known-concern.
- (Next runs append below this line.)
