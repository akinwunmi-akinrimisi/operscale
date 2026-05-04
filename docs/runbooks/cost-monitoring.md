# Cost monitoring runbook

**Status:** Authoritative for Phase 1.
**Owner:** Akinwunmi.
**Last updated:** 2026-05-03.

This document is the operator's guide to keeping costs in check. It pairs with `docs/pricing-and-packages.md` (which sets the targets) and answers the question: "are we hitting our margin targets in practice?"

Cost monitoring is a weekly habit, not a daily one. Phase 1 volume is too low for daily monitoring to be informative, but weekly review catches drift early.

## 1. The cost surfaces

Phase 1 has six cost surfaces. In rough order of magnitude:

1. **Anthropic API** (variable, scales with order volume). Brief analysis $0.12-0.30 per order including re-analyses.
2. **HeyGen** (variable, scales with paid orders). UGC video render $0.50-1.00 per video.
3. **fal.ai** (variable, scales with paid orders). T2V via Veo / Seedance $0.70-3.20 per video.
4. **Supabase Pro** (fixed). $25/month for the production project.
5. **Hostinger VPS** (fixed). KVM 4 plan, ~$8/month.
6. **Resend, Cloudflare, Backblaze, domain** (fixed, low). ~$15/month combined.

Phase 1 monthly fixed cost: ~$50.
Phase 1 variable cost per order: ~$5.90 (Starter) / $16.30 (Standard) / $36.30 (Calendar).

These match `docs/pricing-and-packages.md` exactly.

## 2. The weekly review

Every Monday, run through the queries in section 4 below. Should take 15-20 minutes. Note:

- Total spend across all surfaces.
- Cost per paid order, by tier.
- Anomalies — categories spending much more than expected, or much less.

If everything looks normal, move on. If something looks off, dig in.

## 3. Where the numbers come from

### 3.1 Anthropic spend

Two places to look:

- **Console.anthropic.com** dashboard → Usage. Aggregate spend per day/week.
- **Internal `llm_calls` table.** Per-call detail with brief_id, purpose, cost_usd.

The console is the source of truth for billing. The table is the source of truth for "which orders / which features" the spend was associated with.

### 3.2 HeyGen and fal.ai spend

HeyGen and fal.ai both have dashboards for usage and billing. We don't currently log per-render costs on our side; we rely on their dashboards for spend tracking and on our `orders` table for "which order this was for."

Phase 2 will add per-render cost logging to a `production_renders` table; not in Phase 1 scope.

### 3.3 Fixed costs

Supabase, Hostinger, Resend, Cloudflare, Backblaze, domain — all fixed monthly subscriptions. Tracked in a personal spreadsheet outside this system.

## 4. Standard weekly queries

Run these against the production Supabase database every Monday.

### 4.1 Total Anthropic spend, last 7 days

```sql
select
  date_trunc('day', called_at) as day,
  count(*) as calls,
  sum(cost_usd) as total_cost_usd,
  avg(cost_usd) as avg_cost_usd,
  sum(case when status = 'failed' then cost_usd else 0 end) as failed_cost_usd
from llm_calls
where called_at > now() - interval '7 days'
group by 1
order by 1 desc;
```

What to look for:
- Daily total trending up or down vs prior week.
- Failed-cost percentage above 5% — investigate.
- Average cost per call above $0.30 — likely re-analyze loop or vision-block bloat.

### 4.2 Anthropic spend by purpose, last 7 days

```sql
select
  purpose,
  count(*) as calls,
  sum(cost_usd) as total_cost_usd,
  avg(cost_usd) as avg_cost_usd,
  count(distinct brief_id) as briefs_touched
from llm_calls
where called_at > now() - interval '7 days'
group by purpose
order by total_cost_usd desc;
```

What to look for:
- `brief_analysis_initial` should be the biggest line.
- `brief_analysis_reanalyze` should be ≤ 25% of `brief_analysis_initial` (if higher, the AI prompt needs work).
- New purposes appearing — check that they're intentional and not a bug.

### 4.3 Re-analyze rate, last 30 days

```sql
select
  date_trunc('week', called_at) as week,
  count(case when purpose = 'brief_analysis_initial' then 1 end) as initial_analyses,
  count(case when purpose = 'brief_analysis_reanalyze' then 1 end) as reanalyses,
  round(100.0 * count(case when purpose = 'brief_analysis_reanalyze' then 1 end) /
        nullif(count(case when purpose = 'brief_analysis_initial' then 1 end), 0), 1) as rate_pct
from llm_calls
where called_at > now() - interval '30 days'
group by 1
order by 1;
```

Target: rate ≤25%.

### 4.4 Order volume and revenue, last 7 days

```sql
select
  date_trunc('day', paid_at) as day,
  tier,
  count(*) as orders,
  sum(amount_ngn) as revenue_ngn,
  sum(amount_ngn) / 1650.0 as revenue_usd_estimate
from orders
where status in ('paid', 'production', 'delivered')
  and paid_at > now() - interval '7 days'
group by 1, 2
order by 1 desc, 2;
```

What to look for:
- Daily volume trends.
- Tier mix (target: ≥60% Standard or Calendar combined).
- Revenue per day relative to prior week.

### 4.5 Cost per order by tier, last 30 days

```sql
with tier_costs as (
  select
    o.tier,
    count(distinct o.id) as orders,
    sum(c.cost_usd) as total_ai_cost_usd
  from orders o
  left join briefs b on b.id = o.brief_id
  left join llm_calls c on c.brief_id = b.id
  where o.status in ('paid', 'production', 'delivered')
    and o.paid_at > now() - interval '30 days'
  group by 1
)
select
  tier,
  orders,
  total_ai_cost_usd,
  total_ai_cost_usd / orders as avg_ai_cost_per_order
from tier_costs;
```

What to look for:
- Average AI cost per order should be in the $0.12-$0.30 range (Starter/Standard/Calendar).
- If above $0.40, investigate re-analyze loops.

### 4.6 Drop-off rates, last 7 days

```sql
with metrics as (
  select
    count(*) filter (where current_step >= 1) as started,
    count(*) filter (where current_step >= 3) as reached_step_3,
    count(*) filter (where submitted_at is not null) as submitted
  from briefs
  where created_at > now() - interval '7 days'
),
order_metrics as (
  select
    count(*) filter (where status in ('brief_sent', 'payment_initiated', 'paid', 'production', 'delivered', 'refunded')) as approved,
    count(*) filter (where status in ('payment_initiated', 'paid', 'production', 'delivered', 'refunded')) as initiated_payment,
    count(*) filter (where status in ('paid', 'production', 'delivered', 'refunded')) as paid
  from orders
  where created_at > now() - interval '7 days'
)
select * from metrics, order_metrics;
```

What to look for:
- step_3 / started ratio should be ≥70%.
- submitted / step_3 ratio should be ≥60% (anything lower means form completion friction).
- approved / submitted should be ≥85% (lower means too much discarding).
- paid / approved should be ≥40% (the main conversion lever).

## 5. Monthly cost-vs-target review

At the end of each month, compute actuals vs the targets in `docs/pricing-and-packages.md`.

```sql
select
  o.tier,
  count(*) as orders,
  sum(o.amount_ngn) as revenue_ngn,
  sum(c.cost_usd) as ai_cost_usd
from orders o
left join briefs b on b.id = o.brief_id
left join llm_calls c on c.brief_id = b.id
where o.status in ('paid', 'production', 'delivered')
  and date_trunc('month', o.paid_at) = date_trunc('month', now() - interval '1 month')
group by 1;
```

Compare to `pricing-and-packages.md` per-tier COGS. AI cost is just a slice of total COGS (the rest is HeyGen + fal.ai which we read from their dashboards).

If realised margin is more than 5 percentage points off target on any tier, do a deep dive. Likely culprits:
- Re-analyze rate too high.
- Vision blocks too large (full-res photos sent without downscale).
- T2V quality lane usage above plan.

## 6. Founder-time accounting

Phase 1 deliberately doesn't book founder time as cost in the headline margin numbers. But it's worth tracking weekly:

- **Time spent in CRM**: estimate end-of-week. Target: 30-60 min/day at 5-15 orders/day.
- **Time spent on incident response**: count and triage. Most weeks should be zero.
- **Time spent on customer reply chains**: measure. If this exceeds 2 hours/week, consider templating common responses.

When founder time exceeds 25 hours/week on operational work (not strategic), it's a signal to hire.

## 7. The cost cliff

Three things would meaningfully change Phase 1 cost structure if they happened:

- **Anthropic Opus 4.7 price increase ≥20%.** Re-evaluate tier pricing within 14 days.
- **HeyGen pricing change** affecting per-second cost. Re-evaluate UGC margin within 14 days.
- **fal.ai retiring or changing Veo / Seedance availability.** Switch to alternative provider or absorb cost change.

We have alerts set up for none of these in Phase 1. We rely on:
- The vendor newsletters going to akinwunmi@operscale.ng.
- Monthly cost review catching unexpected jumps.
- Twitter / Hacker News chatter about provider changes.

This is fine for Phase 1. Phase 2 should add programmatic alerts.

## 8. Things we don't currently monitor

Documenting absences so we know what to add later:

- **Cost per refunded order.** A refund means we've spent COGS without revenue. Phase 1 refund target is ≤5%; if it climbs, this becomes a real number to watch.
- **Time-to-payment from brief.** We track it qualitatively. Should be a metric.
- **CRM page load times.** Anecdotally fine; not measured.
- **Email open rates.** Resend gives us this; we don't aggregate it weekly.
- **WhatsApp delivery rates.** Same.

When Phase 1 has 100+ orders, we'll have enough data to build a proper analytics view. Until then, the queries above are sufficient.

## 9. The cost dashboard (future)

Phase 2 may add a `/admin/costs` page in the CRM that runs the queries above on demand and visualises:

- Daily Anthropic spend trend.
- Re-analyze rate over time.
- Order-volume-vs-cost ratio.
- Per-tier margin tracking.

Phase 1 deliberately doesn't build this. The queries are run manually by the founder once a week. This is faster to build and avoids over-engineering early.

## 10. Cross-references

- `docs/pricing-and-packages.md` — the cost targets.
- `docs/specs/ai-brief-analysis.md` — where re-analyze loops and vision-block sizing live.
- `docs/runbooks/crm-runbook.md` — the founder review activity that drives re-analyze rate.
- `docs/runbooks/incident-response.md` — section 11 covers cost-spike triage.
