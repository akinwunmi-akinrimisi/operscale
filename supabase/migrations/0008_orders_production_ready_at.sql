-- 0008_orders_production_ready_at.sql
--
-- Phase 4.6 webhook handler flips orders.status to 'paid' and sets the
-- production_ready_at boundary marker — the timestamp Phase 2 (production
-- pipeline) will read to know an order is ready to pick up.
--
-- The original 0001_init_schema.sql defined production_started_at (when
-- Phase 2 begins work) but NOT production_ready_at. Phase 4.6's design
-- assumed the column already existed; the live smoke caught the gap.
-- Per CLAUDE.md "Schema changes are immutable migrations" this is a new
-- migration rather than an edit to 0001.
--
-- Semantics:
--   • paid_at: when Paystack confirmed payment (set on charge.success).
--   • production_ready_at: when the order is ready for Phase 2 pickup.
--     In Phase 1 this fires alongside paid_at on charge.success. A future
--     hold/QC step could decouple these two timestamps without schema change.
--   • production_started_at: when Phase 2 actually begins (out of scope here).

begin;

alter table orders
  add column if not exists production_ready_at timestamp with time zone;

commit;
