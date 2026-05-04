# Incident response runbook

**Status:** Authoritative for Phase 1.
**Owner:** Akinwunmi.
**Last updated:** 2026-05-03.

This document is the playbook for production incidents. It's organised by symptom — "the thing the customer or founder noticed" — rather than by cause, because that's how incidents actually present.

When something is on fire, you don't need theory. Find the symptom, follow the steps.

## 1. Severity definitions

We use four severity levels:

- **SEV-1**: Customer-visible outage. Marketing site down, form not accepting submissions, payment failing for everyone, or data loss in progress.
- **SEV-2**: Customer-visible degradation. Some submissions failing, some emails not sending, AI analysis backed up beyond 1 hour.
- **SEV-3**: Internal-only impact. CRM is slow but working, Realtime subscriptions flaky, dashboard out of date but data is correct.
- **SEV-4**: Cosmetic or low-impact. A timestamp is wrong, a label is unclear, a recovery email went to spam.

Phase 1 has one operator (Akinwunmi). Severity drives urgency, not staffing.

## 2. The first 60 seconds of any incident

Before diagnosing, do these:

1. **Note the time.** Incident start time matters for the postmortem.
2. **Check the obvious.** Is the VPS up? `ping srv1297445.hstgr.cloud`. Is your internet up? Is the URL correct?
3. **Check Cloudflare / Hostinger status.** Sometimes it's not us.
4. **Capture state.** Take a screenshot or copy any error message before you fix anything. The fix is usually easy; understanding the failure later is harder.

Then proceed to the symptom-specific section below.

## 3. Marketing site is down (SEV-1)

**Symptom:** Customer reports the site won't load, or you load `https://operscale.cloud` and get a Cloudflare error / Hostinger error / blank page.

**Diagnosis steps:**

```bash
# 1. Is the VPS up?
ping srv1297445.hstgr.cloud
# If timeout: Hostinger-side issue. Skip to step 4.

# 2. SSH into the VPS.
ssh root@srv1297445.hstgr.cloud

# 3. Are containers running?
docker ps
# Expect: web (Next.js marketing site), agent (AI worker), traefik, supabase containers.

# 4. If web is missing or stopped:
docker logs --tail 100 web
docker compose -f /root/calendar/docker-compose.yml up -d web
```

**Common causes and fixes:**

- **Web container OOM-killed.** Logs will show `Killed`. `docker stats` for a snapshot. Restart with `docker compose up -d web`. If it dies again, the deploy is bad — roll back: `git checkout <previous-sha> && docker compose up -d --build web`.
- **Traefik cert renewal failed.** Browser shows cert error. `docker logs traefik` will show the renewal attempt. Most often a Cloudflare DNS challenge issue; verify DNS records with `dig operscale.cloud`.
- **Hostinger network issue.** Check status.hostinger.com. Wait it out — there's nothing to fix on your end.

**Communication:** If Cloudflare's downtime page is up, customers see a sane error. If it's an OOM-and-restart, the outage is usually under 90 seconds. If outage exceeds 5 minutes during business hours, post a brief WhatsApp status to active customers ("brief site issue, working on it now").

**Recovery target:** ≤5 minutes for container restarts. ≤30 minutes for Hostinger-side incidents.

## 4. Form submission fails for everyone (SEV-1)

**Symptom:** Customer reports submitting brief and getting an error. You test it yourself and confirm.

**Diagnosis:**

```bash
# 1. Marketing site logs.
docker logs --tail 200 web | grep -i error

# 2. Supabase reachable from the web container?
docker exec web wget -O- https://supabase.operscale.cloud/rest/v1/ -H "apikey: $SUPABASE_ANON_KEY"

# 3. Supabase logs.
docker logs --tail 200 supabase-postgres
docker logs --tail 200 supabase-postgrest
```

**Common causes:**

- **Supabase Postgres maxed out connections.** PostgREST reports "too many connections". Restart Supabase: `docker compose restart supabase-postgres supabase-postgrest`. Investigate connection pooling later.
- **Disk full.** `df -h`. Logs are usually the culprit. Rotate immediately: `truncate -s 0 /var/lib/docker/containers/*/*-json.log` (drastic but works in a pinch).
- **Anthropic key invalid / quota.** This shouldn't fail submissions (AI runs async post-submit), but if the agent service is misconfigured to fail-loud, it might. Check `docker logs agent`.

**If submissions are queued but failing async:** The form returns success (customer sees it), but the AI analysis job is failing. That's SEV-2, not SEV-1. See section 6.

**Recovery target:** ≤15 minutes.

## 5. Payment webhook failures (SEV-1)

**Symptom:** Customer paid but order is still in `payment_initiated` after 5 minutes. Or you got a Paystack alert about webhook failures.

**Diagnosis:**

```bash
# 1. Check most recent Paystack webhook attempts.
docker logs --tail 500 web | grep -i paystack

# 2. Verify the webhook endpoint is reachable from outside.
curl -X POST https://operscale.cloud/api/webhook/paystack -H "x-paystack-signature: test"
# Expect 401 (signature invalid). If 5xx or timeout, the endpoint is broken.

# 3. Check the Paystack dashboard's Webhook section.
# It shows recent deliveries and their response codes.
```

**Common causes and fixes:**

- **HMAC verification failing.** Production secret key doesn't match the one used to sign. Verify `PAYSTACK_SECRET_KEY` in `.env` matches the one in Paystack dashboard. Restart web container.
- **Webhook endpoint returning 5xx.** Application bug. Check logs for the stack trace. Fix and deploy.
- **Order lookup by tx_ref failing.** The `paystack_tx_ref` may be missing from the order row (race condition between Paystack callback and webhook). Manually correlate via Paystack dashboard and update the order:
  ```sql
  update orders set status = 'paid', paid_at = now(), paystack_tx_ref = '<tx_ref>'
  where id = '<order_id>';
  ```
- **Idempotency conflict** (`paystack_event_id` UNIQUE violation). This is intentional; Paystack retried a successfully-processed webhook. Confirm the order is `paid` and ignore.

**Manual remediation if customer is stuck:**

1. Verify in Paystack dashboard that payment succeeded.
2. Manually update order status:
   ```sql
   begin;
   insert into payments (order_id, paystack_event_id, event_type, amount_ngn, raw_payload, webhook_received_at)
     values ('<order_id>', '<paystack_event_id>', 'charge.success.manual', <amount>, '{}'::jsonb, now());
   update orders set status = 'paid', paid_at = now() where id = '<order_id>';
   commit;
   ```
3. Manually trigger payment confirmation email (CRM has a "re-send payment confirmation" action).
4. Manually send WhatsApp confirmation.

**Recovery target:** Customer-visible state correct within 30 minutes of issue detected.

## 6. AI analysis backed up (SEV-2)

**Symptom:** Pending Review queue shows briefs sitting for 30+ minutes without AI output. Or new briefs arriving with no analysis.

**Diagnosis:**

```bash
# 1. Agent container running?
docker ps | grep agent
docker logs --tail 200 agent

# 2. Anthropic API status.
# https://status.anthropic.com

# 3. Check for failed llm_calls rows.
psql ... -c "select * from llm_calls where status = 'failed' and called_at > now() - interval '1 hour';"

# 4. Check recent ai_analysis_failed activity_log entries.
psql ... -c "select * from activity_log where event_type = 'ai_analysis_failed' and occurred_at > now() - interval '1 hour';"
```

**Common causes:**

- **Anthropic 5xx.** Wait it out. Retry logic should handle most. Check status.anthropic.com.
- **Anthropic quota / rate limit.** Spend dashboard at console.anthropic.com. Increase limits if needed.
- **Agent container OOM.** `docker logs agent | grep -i killed`. Restart and investigate memory leak.
- **Local queue stuck.** Restart the agent: `docker compose restart agent`.

**Customer-visible mitigation:**

If 5+ briefs are stuck for 30+ minutes during business hours, the founder may need to:
1. Manually write briefs for the affected customers using form data.
2. Send brief emails directly (CRM has a "send manual brief" action).
3. Note the failure for postmortem.

The auto-ack email already promised "within an hour" — buying back trust matters more than waiting for a fix.

**Recovery target:** AI service operational within 30 minutes; backlog cleared within 2 hours.

## 7. Resend email delivery failing (SEV-2 to SEV-3)

**Symptom:** Customers report not receiving auto-ack or brief emails. CRM shows `email_log` rows with `bounced_at` set.

**Diagnosis:**

```bash
# 1. Resend dashboard. Check delivery status of recent sends.
# https://resend.com/dashboard

# 2. Check email_log for patterns.
psql ... -c "select template_key, count(*), count(bounced_at) as bounced
             from email_log where sent_at > now() - interval '24 hours'
             group by template_key;"
```

**Common causes:**

- **Resend domain DNS misconfigured.** SPF / DKIM / DMARC records broken. Verify in Resend dashboard. Cloudflare DNS console for fixes.
- **Specific recipient bouncing.** `bounce_reason` will say. If customer typo'd their email, contact via WhatsApp.
- **Resend rate-limited.** Quota exceeded. Upgrade Resend plan or wait.
- **Template change broke rendering.** Recent deploy changed an email template; new sends fail to render. Roll back the template change.

**Recovery target:** Email delivery restored within 1 hour. Backlog re-sends as soon as service is up.

## 8. WhatsApp delivery failing (SEV-2 to SEV-3)

**Symptom:** Customers don't receive WhatsApp messages. CRM `whatsapp_log` rows with `failed_at` set.

**Diagnosis:**

```bash
# 1. Evolution API container status.
ssh root@srv1297445.hstgr.cloud  # VPS 2 if separate
docker logs --tail 200 evolution-api

# 2. Number registered with WhatsApp Business?
# Check Evolution API admin panel.

# 3. Customer's number valid for WhatsApp?
# Some customers provide phone numbers that aren't WhatsApp-active.
```

**Common causes:**

- **Evolution API session expired.** Re-link the WhatsApp Business account via the admin panel.
- **Customer's number not on WhatsApp.** Fall back to email; flag in customer record so future messages go email-only.
- **Rate limit on outbound messages.** WhatsApp Business has limits on unverified numbers; consider verification.

**Recovery target:** Service restored within 1 hour for systemic issues. Per-customer issues handled in CRM via fallback email.

## 9. Photo retention sweep failing (SEV-3)

**Symptom:** Daily monitoring shows the `photo-retention-sweep` Edge Function not completing, or photos older than their `scheduled_delete_at` still exist in Storage.

**Diagnosis:**

```bash
# 1. Edge Function logs.
# Supabase dashboard -> Edge Functions -> photo-retention-sweep -> Logs.

# 2. Manual sweep query.
psql ... -c "select count(*) from brief_photos
             where scheduled_delete_at <= now() and deleted_at is null;"
```

**Recovery:**

- Manually trigger the Edge Function from the Supabase dashboard.
- If it fails, check the Storage permissions (service role should be able to delete).
- File an issue and run the sweep manually in batches until automated sweep is fixed.

This is not customer-facing in normal cases. NDPC compliance is the only stake — we promised 90-day retention; falling behind by a day or two is OK, falling behind by a week is a compliance issue.

**Recovery target:** Sweep operational within 24 hours.

## 10. Database is slow (SEV-3)

**Symptom:** CRM Pending Review queue takes 5+ seconds to load. SQL queries are timing out.

**Diagnosis:**

```bash
# 1. Connection count.
psql ... -c "select count(*) from pg_stat_activity;"

# 2. Long-running queries.
psql ... -c "select pid, now() - pg_stat_activity.query_start as duration, query
             from pg_stat_activity
             where (now() - pg_stat_activity.query_start) > interval '5 seconds'
             and state = 'active';"

# 3. Disk usage on the VPS.
df -h
```

**Common causes:**

- **A long-running query holding locks.** Identify with `pg_stat_activity`, kill: `select pg_terminate_backend(<pid>);`.
- **Disk near full.** Postgres slows when disk is tight. Free space (rotate logs, clean Docker images: `docker system prune -af`).
- **Vacuum behind.** `VACUUM ANALYZE` on the busiest tables.

**Recovery target:** Restored within 30 minutes. If patterns recur, schedule a Supabase tier upgrade.

## 11. Cost spike (SEV-3 to SEV-2)

**Symptom:** Anthropic spend significantly above expected.

**Diagnosis:**

```sql
select purpose, count(*), sum(cost_usd), avg(cost_usd)
from llm_calls
where called_at > now() - interval '24 hours'
group by purpose
order by sum(cost_usd) desc;
```

**Common causes:**

- **Re-analyze loop.** Founder is hitting "Re-analyze with note" 5+ times on a single brief. Each costs ~$0.12. Address by reviewing the AI prompt for the failure mode.
- **Retry storm.** Anthropic 5xx triggered the 5-retry policy on every job for a window. Costs accumulate fast. Tune retry policy if needed.
- **Vision blocks on large photos.** Customer uploaded full-resolution photos and we didn't downscale before sending. Verify the photo-resize step in the agent pipeline.

**Recovery target:** Identify cause within 1 hour of spike notice; fix within 24 hours.

## 12. Founder's incident-response checklist

When you're in the middle of an incident, follow this in order. Do not skip steps.

1. **Capture the symptom.** Screenshot or text. Time-stamped.
2. **Determine severity.** SEV-1 / SEV-2 / SEV-3 / SEV-4.
3. **Communicate** if SEV-1 or SEV-2. WhatsApp active customers if customer-visible.
4. **Diagnose** using the symptom section above.
5. **Fix or roll back.** Forward fix when easy; roll back when uncertain.
6. **Verify** the fix in production before declaring resolution.
7. **Postmortem** — when you have time. What broke. Why. What we'll do to prevent it.

Postmortems live in `docs/postmortems/YYYY-MM-DD-short-name.md`. Even brief ones. Even SEV-3s. They're how the system gets stronger over time.

## 13. Useful commands cheat sheet

```bash
# Check container status.
docker ps

# Tail logs of a specific container.
docker logs --tail 200 -f <container-name>

# Restart a single service.
docker compose restart <service-name>

# Full deploy (only if rollback isn't safer).
cd /root/calendar && git pull && docker compose up -d --build

# Roll back to previous SHA.
cd /root/calendar && git log --oneline -10
git checkout <previous-sha>
docker compose up -d --build

# Check disk space.
df -h

# Free up Docker disk space.
docker system prune -af --volumes  # CAREFUL: removes unused volumes too

# Postgres connection counts.
psql -h supabase.operscale.cloud -U postgres -c "select count(*), state from pg_stat_activity group by state;"

# Tail Supabase logs.
docker logs --tail 200 -f supabase-postgres

# Manual photo retention sweep.
curl -X POST https://supabase.operscale.cloud/functions/v1/photo-retention-sweep \
  -H "Authorization: Bearer $SUPABASE_SERVICE_ROLE_KEY"
```

## 14. What's deliberately NOT in this runbook

- **PagerDuty / on-call rotations.** Phase 1 is one operator; if you're asleep, the system has to handle itself for 6-8 hours. The auto-ack email's "within an hour during business hours, by 9 AM next day after hours" is what makes that survivable.
- **Incident commander roles.** Single operator means single decision-maker.
- **Customer notification scripts.** Phase 1 customer base is small; customer comms during incidents are personal WhatsApps, not templated emails.

When the team grows, this section becomes the seed for proper incident response. Not yet.
