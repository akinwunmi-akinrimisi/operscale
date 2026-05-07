# Continuation prompt — Operscale Calendar AUTH HOTFIX (PKCE blocker)

**Phase 5 CRM is built and accessible at https://operscale.cloud/admin BUT magic-link sign-in fails at the round-trip.** The founder cannot actually log in. This handoff is a focused hotfix session — NOT Phase 6. Phase 6 (customer brief form) is deferred until auth works.

## What's been ruled in/out (don't re-test these)

The previous session went in circles. Here's what's confirmed working:

✅ **Allowlist** — `app.admin_emails` Postgres parameter has all 3 founder emails. Verified via `SHOW app.admin_emails`.
✅ **SMTP relay** — GoTrue uses Resend SMTP via `smtp.resend.com:587`. Resend logs confirm magic-link emails delivered to `akinolaakinrimisi@gmail.com` from `Operscale CRM <akinwunmi.akinrimisi@operscale.cloud>`. Subject "Your Magic Link".
✅ **Form `NEXT_PUBLIC_*` inlining** — apps/web Dockerfile takes ARGs; compose passes them via `build.args`. Bundle now contains supabase URL + anon key. SignInForm has try/catch that surfaces errors instead of hanging at "Sending…".
✅ **Email link `redirect_to`** — points to `https://operscale.cloud/auth/callback` correctly (URI_ALLOW_LIST has 6 literal entries — wildcards `**` did NOT match in GoTrue v2.151.0, literal entries do).
✅ **/auth/callback route exists** — has `proxyAwareUrl` helper that strips bind port from `x-forwarded-host`. Redirects to `https://operscale.cloud/admin?reason=expired` on failure (correct host, correct port).

## What's broken

❌ **`exchangeCodeForSession(code)` fails server-side.** Token in email starts with `pkce_` confirming PKCE flow. The flow:
1. Form submits → supabase-js generates `code_verifier` + `code_challenge`. Stores `code_verifier` as a browser cookie. Sends `code_challenge` to Supabase.
2. Email link → `https://supabase.operscale.cloud/verify?token=pkce_<...>&type=magiclink&redirect_to=https://operscale.cloud/auth/callback`.
3. Click → Supabase verifies token → 302 to `https://operscale.cloud/auth/callback?code=<auth_code>`.
4. **Our route handler calls `exchangeCodeForSession(code)` which needs the `code_verifier` cookie. The exchange fails.** Founder bounces back to `/admin?reason=expired&detail=<encoded_error>`.

The root suspect: cross-host cookie handling. Cookie was set on `operscale.cloud` (when supabase-js initialized in the form page). Browser navigates `operscale.cloud → supabase.operscale.cloud → operscale.cloud` — `SameSite=Lax` allows top-level navigation cookies, but the cookie path/domain may be wrong, OR there's a different issue entirely.

**Diagnostic logging is in place** (commit `54f892b`). After the founder retries and lands on `/admin?reason=expired&detail=<...>`:
- Read the URL `&detail=...` portion → that's the exact error message.
- OR read web container logs: `docker logs --tail=20 operscale-calendar-web 2>&1 | grep "auth/callback"`.

## Likely fix paths (in order of preference)

### Path A — One-line cookie domain fix (try first)

In `apps/web/src/lib/supabase-browser.ts`, current cookieOptions:
```typescript
_client = createBrowserClient(url, anonKey, {
  cookieOptions: { sameSite: 'lax', secure: true } satisfies CookieOptions,
});
```

Add `domain: '.operscale.cloud'` (note the leading dot) so the cookie is shared across `operscale.cloud` AND `supabase.operscale.cloud`:
```typescript
_client = createBrowserClient(url, anonKey, {
  cookieOptions: { sameSite: 'lax', secure: true, domain: '.operscale.cloud' } satisfies CookieOptions,
});
```

Also patch `apps/web/src/lib/supabase-server.ts` getSupabaseMiddleware + getSupabaseServer to set the same domain on cookie write paths. The setAll function in both factories takes `cookiesToSet: { name, value, options }[]` — wrap to inject `domain: '.operscale.cloud'` into each `options`.

Rebuild web (the build-args pattern is in place). Test from form. If `exchangeCodeForSession` now succeeds, ship it.

### Path B — Switch to implicit flow (fallback if A fails)

```typescript
import { createBrowserClient } from '@supabase/ssr';

_client = createBrowserClient(url, anonKey, {
  auth: { flowType: 'implicit' },
  cookieOptions: { sameSite: 'lax', secure: true },
});
```

Implicit flow returns `access_token` + `refresh_token` directly in the URL fragment after the verify hop. The `/auth/callback` route handler can't read fragments (server-side has no access). Need a CLIENT page at `/auth/callback` that:
1. Reads `window.location.hash`.
2. Calls `supabase.auth.setSession({ access_token, refresh_token })` — this sets the session cookie.
3. Calls `router.replace('/admin/pending-review')`.

That means converting `/auth/callback/route.ts` (Route Handler) into `/auth/callback/page.tsx` (Client Component). Keep the `founder_signed_in` activity_log INSERT but move it into the client page (it'll run after setSession).

Tradeoff: implicit flow is less secure than PKCE (token visible in URL fragment, can leak via referer headers, browser history). For an internal admin tool with HTTPS-only and low traffic, the security delta is acceptable. Document as a deliberate Phase 5 simplification.

### Path C — Custom server-side OTP verification (last resort)

Skip supabase-js's exchange entirely. The /auth/callback route directly calls Supabase's verify endpoint server-side with the token from the URL. More code; needs a careful migration but full control over cookie/session semantics.

## Ground rules for the next session

1. **Diagnose first.** Get the founder to retry → read the `&detail=` query string OR `docker logs operscale-calendar-web | grep auth/callback`. The actual error message will tell you if it's the PKCE cookie issue (look for "code verifier could not be found" or similar) or something else.
2. **Don't go in circles** like the previous session did. Apply the highest-likelihood fix (Path A), test once end-to-end, and move on. If A fails, jump straight to B (don't iterate variants on A).
3. **Don't restart auth-1 unnecessarily.** The shared Supabase compose is correctly configured (per memory). Touch only apps/web.
4. **Verify END-TO-END before declaring done.** Founder enters email → form sent state → email arrives → click link → land on `/admin/pending-review` with founder_signed_in row in activity_log. Anything short of that is not done.
5. **DON'T** add new abstractions or refactors during this hotfix. Minimum diff to fix.

## Live verification one-liners

```bash
# Magic link: trigger from CLI to test the wire path
ANON_KEY="<see /etc/operscale-calendar/web.env on VPS>"
curl -s -X POST "https://supabase.operscale.cloud/auth/v1/otp?redirect_to=https%3A%2F%2Foperscale.cloud%2Fauth%2Fcallback" \
  -H "apikey: $ANON_KEY" -H "Content-Type: application/json" \
  -d '{"email":"akinolaakinrimisi@gmail.com"}'
# expects: HTTP 200 + {} body. Founder gets email within ~10s. RATE LIMIT: 1 per 60s per email.

# Read the link Resend sent (for inspection without using the live token):
RESEND_KEY="<see master .env>"
EMAIL_ID=$(curl -s "https://api.resend.com/emails?limit=1" -H "Authorization: Bearer $RESEND_KEY" | python -c "import json,sys; print(json.load(sys.stdin)['data'][0]['id'])")
curl -s "https://api.resend.com/emails/$EMAIL_ID" -H "Authorization: Bearer $RESEND_KEY" | python -c "import json,sys,re; html=json.load(sys.stdin).get('html',''); [print(u) for u in re.findall(r'href=[\"\\']([^\"\\'>]+)[\"\\']', html)]"

# Web container logs (to read exchange errors from the diagnostic logging):
PYTHONIOENCODING=utf-8 python -c "
import paramiko, pathlib
pw = next(l.split('=', 1)[1].strip() for l in pathlib.Path(r'c:\Users\DELL\Documents\Antigravity\operscale-calender\.env').read_text(encoding='utf-8').splitlines() if l.startswith('server_password='))
c = paramiko.SSHClient(); c.set_missing_host_key_policy(paramiko.AutoAddPolicy())
c.connect('srv1297445.hstgr.cloud', 22, 'root', pw, timeout=20, allow_agent=False, look_for_keys=False)
_, out, _ = c.exec_command('docker logs --tail=50 operscale-calendar-web 2>&1', timeout=15)
print(out.read().decode())
c.close()
"

# After committing a fix to apps/web/src/lib/supabase-browser.ts, rebuild + restart web:
PYTHONIOENCODING=utf-8 python -c "
import paramiko, pathlib, time
pw = next(l.split('=', 1)[1].strip() for l in pathlib.Path(r'c:\Users\DELL\Documents\Antigravity\operscale-calender\.env').read_text(encoding='utf-8').splitlines() if l.startswith('server_password='))
c = paramiko.SSHClient(); c.set_missing_host_key_policy(paramiko.AutoAddPolicy())
c.connect('srv1297445.hstgr.cloud', 22, 'root', pw, timeout=30, allow_agent=False, look_for_keys=False)
_, out, _ = c.exec_command('cd /docker/operscale-calendar/repo && git fetch origin main && git reset --hard origin/main && cd /docker/operscale-calendar && docker compose up -d --build web 2>&1', timeout=300)
print(out.read().decode()[-1500:])
c.close()
"
```

## System context (paste FIRST in the new session)

```
Working directory: C:\Users\DELL\Documents\Antigravity\operscale-calender\operscale-calendar-platform

AUTH HOTFIX session. CRM live at https://operscale.cloud/admin but magic-link
sign-in fails at /auth/callback. The exchangeCodeForSession call rejects
the PKCE code; founder bounces back to /admin?reason=expired&detail=...
diagnostic logging is in place (commit 54f892b).

Memory at C:\Users\DELL\.claude\projects\C--Users-DELL-Documents-
Antigravity-operscale-calender\memory\ auto-loads. Read MEMORY.md +
project_state.md FIRST — the "AUTH BLOCKER" section ends with three
ranked fix paths. Try Path A (one-line cookie domain fix) first.

NON-NEGOTIABLE: NO API KEYS OR SECRETS COMMITTED OR PUSHED, EVER.
Master .env at parent dir: C:\Users\DELL\Documents\Antigravity\
operscale-calender\.env. PYTHONIOENCODING=utf-8 for paramiko scripts.

Working pattern (do NOT deviate):
- Diagnose first. Get the founder to retry the magic-link flow with
  diagnostic logging in place. Read &detail= from URL OR
  `docker logs operscale-calendar-web | grep auth/callback`.
- Apply Path A (cookie domain fix) — single-line change to
  apps/web/src/lib/supabase-browser.ts (and matching server.ts changes).
- Rebuild web on VPS via paramiko one-liner.
- Verify END-TO-END: founder enters email → form sent state → email
  arrives → click link → lands on /admin/pending-review with
  founder_signed_in row in activity_log.
- If Path A fails, jump straight to Path B (implicit flow + client-side
  callback page). Don't iterate variants on A.
- Do NOT touch shared Supabase compose. The auth container config is
  already correct.
- Do NOT add abstractions or refactors. Minimum diff to fix.

Recent commits to check:
  git log --oneline -8
  # 54f892b fix(web): surface exchangeCodeForSession error in callback
  # 5b9e46a fix(web): inline NEXT_PUBLIC_* at Docker build + try/catch
  # c535a6a fix(web): /auth/callback strip bind port when x-forwarded-host
  # 6c381eb chore(phase-5): close-out
  # ... (Phase 5 commits)

Phases 1-5 are LIVE end-to-end except for the founder being unable to
sign in. Verify with:
  curl -sI https://api.operscale.cloud/v1/health           → 200
  curl -sI https://operscale.cloud/admin                   → 200
  curl -sI https://operscale.cloud/auth/callback           → 307 to /admin?reason=expired

Migrations 0001-0010 applied to staging Supabase.
```

## First message (paste AFTER the system context)

```
Begin AUTH HOTFIX. Read MEMORY.md, project_state.md (especially
"AUTH BLOCKER" section), and apps/web/src/app/auth/callback/route.ts +
apps/web/src/lib/supabase-browser.ts + apps/web/src/lib/supabase-server.ts.

Then either:
(a) Ask me to retry the magic-link sign-in flow so we can capture the
    actual exchangeCodeForSession error from the redirect URL or web
    container logs.
(b) If you're confident the PKCE-cookie-domain hypothesis is correct
    based on the existing diagnostics, apply Path A (cookie domain
    fix) directly: add `domain: '.operscale.cloud'` to cookieOptions
    in supabase-browser.ts AND inject the same domain into the
    cookiesToSet handler in supabase-server.ts (both getSupabaseServer
    and getSupabaseMiddleware).

Either way: ONE fix attempt, tested end-to-end before iterating.
If Path A fails, switch to Path B (implicit flow). Don't iterate
on A.

End-state acceptance: I (founder, akinolaakinrimisi@gmail.com) can
sign in via the magic link and land on /admin/pending-review with a
founder_signed_in row in activity_log. Anything short of that = not
done.

NEVER:
- Commit/push secrets. Public repo.
- Use git --no-verify.
- Touch shared Supabase compose at /docker/supabase/. Auth-1 config
  is correct.
- Add new abstractions or refactors during this hotfix.
- Disable, mock, or fall back to make a test pass. Real fix only.
```
