-- 0007_orders_founder_approved_status.sql
--
-- The Phase 4 approve route flips orders.status to 'founder_approved' as an
-- intermediate state between founder review and the Phase 4.5 brief-email send.
-- The Phase 4.5 approve extension then transitions to 'brief_sent'.
--
-- brief_email_failed is the retry-eligible failure state documented in AGENT.md §244
-- and docs/specs/founder-review-flow.md. It is added here alongside founder_approved
-- so both statuses are available before the Phase 4.5 plan ships.
--
-- The original CHECK constraint in 0001_init_schema.sql is immutable. We drop and
-- re-add it here as a new constraint following the immutable-migration rule in CLAUDE.md.

begin;

alter table orders
  drop constraint if exists orders_status_check;

alter table orders
  add constraint orders_status_check check (status in (
    'pending_founder_review',
    'founder_approved',
    'discarded',
    'brief_sent',
    'brief_email_failed',
    'payment_initiated',
    'paid',
    'production',
    'delivered',
    'refunded'
  ));

commit;
