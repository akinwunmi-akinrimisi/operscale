-- 0006_ai_analysis_jobs.sql
--
-- Phase 1 of V2 brief-analysis pipeline.
-- Source: docs/specs/v2-pipeline-implementation-design.md §4.1.
--
-- Creates the durable queue table the worker container polls. Adds:
--  - ai_analysis_jobs table with status enum + idempotency_key
--  - constraint trigger enforcing founder_note + prior_run_id for re_analyze_*
--  - replica identity full (CLAUDE.md gotcha #4)
--  - RLS: anon denied; founder reads via JWT claim; service_role bypasses

create table ai_analysis_jobs (
  id                uuid primary key default gen_random_uuid(),
  brief_id          uuid not null references briefs(id) on delete cascade,
  trigger_type      text not null check (trigger_type in (
                      'initial',
                      're_analyze_same_frameworks',
                      're_analyze_new_frameworks')),
  founder_note      text,
  prior_run_id      uuid references analysis_runs(id),
  status            text not null default 'queued' check (status in (
                      'queued','running','completed','failed')),
  attempt_count     int  not null default 0,
  idempotency_key   text not null unique,
  enqueued_at       timestamptz not null default now(),
  started_at        timestamptz,
  completed_at      timestamptz,
  error_detail      jsonb,
  resulting_run_id  uuid references analysis_runs(id)
);

create index ai_analysis_jobs_pickup_idx on ai_analysis_jobs (status, enqueued_at);
create index ai_analysis_jobs_brief_idx  on ai_analysis_jobs (brief_id);

-- Constraint trigger: founder_note + prior_run_id required when
-- trigger_type starts with 're_analyze_'.
create or replace function ai_analysis_jobs_validate_reanalyze()
returns trigger language plpgsql as $body$
begin
  if new.trigger_type like 're_analyze_%' then
    if new.founder_note is null or length(trim(new.founder_note)) = 0 then
      raise exception 'founder_note required for trigger_type %', new.trigger_type;
    end if;
    if new.prior_run_id is null then
      raise exception 'prior_run_id required for trigger_type %', new.trigger_type;
    end if;
  end if;
  return new;
end;
$body$;

create trigger ai_analysis_jobs_validate_reanalyze_trg
  before insert or update on ai_analysis_jobs
  for each row execute function ai_analysis_jobs_validate_reanalyze();

-- CLAUDE.md gotcha #4: Realtime needs full row payload on UPDATE.
alter table ai_analysis_jobs replica identity full;

-- RLS: anon denied; founder reads (CRM job-status panel); service_role bypasses RLS.
alter table ai_analysis_jobs enable row level security;

create policy ai_analysis_jobs_anon_deny
  on ai_analysis_jobs as restrictive for all to anon using (false);

create policy ai_analysis_jobs_founder_read
  on ai_analysis_jobs as permissive for select to authenticated
  using ((auth.jwt() ->> 'role') = 'founder');

comment on table ai_analysis_jobs is
  'Durable queue for V2 brief analysis. Worker polls for status=queued and claims with FOR UPDATE SKIP LOCKED.';
