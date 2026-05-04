-- 0003_realtime_publication.sql
--
-- Add the three Realtime-published tables to supabase_realtime.
-- Source: docs/data-model.md §6.
--
-- Subscriptions:
--   * pending-review channel — orders WHERE status='pending_founder_review'
--   * order-detail-{order_id} channel — orders + analysis_runs + activity_log for one order
--
-- REPLICA IDENTITY FULL is set in 0001_init_schema.sql for all three tables
-- (per CLAUDE.md gotcha #4).

begin;

alter publication supabase_realtime add table orders;
alter publication supabase_realtime add table analysis_runs;
alter publication supabase_realtime add table activity_log;

commit;
