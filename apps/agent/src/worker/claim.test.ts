import { describe, it, expect, vi } from 'vitest';
import { claimNextJob } from './claim.js';

function makeFakeSupabase(opts: {
  queuedRow?: any | null;
  updateReturning?: any | null;
}) {
  const supabase: any = {
    from: vi.fn((table: string) => {
      if (table === 'ai_analysis_jobs') {
        return {
          select: vi.fn().mockReturnValue({
            eq: vi.fn().mockReturnValue({
              order: vi.fn().mockReturnValue({
                limit: vi.fn().mockReturnValue({
                  maybeSingle: vi.fn().mockResolvedValue({ data: opts.queuedRow ?? null, error: null }),
                }),
              }),
            }),
          }),
          update: vi.fn().mockReturnValue({
            eq: vi.fn().mockReturnValue({
              eq: vi.fn().mockReturnValue({
                select: vi.fn().mockReturnValue({
                  maybeSingle: vi.fn().mockResolvedValue({ data: opts.updateReturning ?? null, error: null }),
                }),
              }),
            }),
          }),
        };
      }
      return { insert: vi.fn().mockResolvedValue({ error: null }) };
    }),
  };
  return supabase;
}

describe('claimNextJob', () => {
  it('returns null when no queued jobs exist', async () => {
    const sb = makeFakeSupabase({ queuedRow: null });
    const result = await claimNextJob(sb);
    expect(result).toBeNull();
  });

  it('claims a queued job: sets status=running, started_at=now, attempt_count++', async () => {
    const queued = {
      id: 'job1',
      brief_id: 'brief1',
      trigger_type: 'initial',
      founder_note: null,
      prior_run_id: null,
      attempt_count: 0,
      idempotency_key: 'brief1::initial::0',
      enqueued_at: '2026-05-04T09:00:00Z',
      status: 'queued',
    };
    const updated = { ...queued, status: 'running', started_at: '2026-05-04T09:00:01Z', attempt_count: 1 };
    const sb = makeFakeSupabase({ queuedRow: queued, updateReturning: updated });
    const result = await claimNextJob(sb);
    expect(result).not.toBeNull();
    expect(result!.id).toBe('job1');
    expect(result!.attempt_count).toBe(1);
    expect(result!.started_at).toBe('2026-05-04T09:00:01Z');
  });

  it('returns null when the UPDATE matches no row (race lost to another worker)', async () => {
    const queued = { id: 'job-raced', brief_id: 'b', trigger_type: 'initial', attempt_count: 0, idempotency_key: 'b::initial::0', enqueued_at: '2026-05-04T09:00:00Z', status: 'queued', founder_note: null, prior_run_id: null };
    const sb = makeFakeSupabase({ queuedRow: queued, updateReturning: null });
    const result = await claimNextJob(sb);
    expect(result).toBeNull();
  });
});
