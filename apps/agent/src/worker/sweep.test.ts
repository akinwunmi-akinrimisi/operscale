import { describe, it, expect, vi } from 'vitest';
import { sweepStuckJobs } from './sweep';

function makeFakeSupabase() {
  const calls: any[] = [];
  const stuckJobs: any[] = [];
  const updateRows: any[] = [];
  const supabase: any = {
    from: vi.fn((table: string) => {
      if (table === 'ai_analysis_jobs') {
        return {
          select: vi.fn().mockReturnValue({
            eq: vi.fn().mockReturnValue({
              lt: vi.fn().mockResolvedValue({ data: stuckJobs, error: null }),
            }),
          }),
          update: vi.fn().mockImplementation((row: any) => {
            updateRows.push(row);
            return { eq: vi.fn().mockResolvedValue({ error: null }) };
          }),
        };
      }
      return { insert: vi.fn().mockImplementation(async (row: any) => {
        calls.push({ table: 'activity_log', row });
        return { error: null };
      }) };
    }),
    _stuckJobs: stuckJobs,
    _updateRows: () => updateRows,
    _calls: () => calls,
  };
  return supabase;
}

describe('sweepStuckJobs', () => {
  it('returns immediately when no stuck jobs are found', async () => {
    const sb = makeFakeSupabase();
    await sweepStuckJobs(sb);
    expect(sb._updateRows()).toEqual([]);
    expect(sb._calls()).toEqual([]);
  });

  it('reclaims a stuck job (attempt_count < 3): sets status=queued, started_at=null, attempt_count++', async () => {
    const sb = makeFakeSupabase();
    sb._stuckJobs.push({ id: 'job1', attempt_count: 1 });
    await sweepStuckJobs(sb);
    const updates = sb._updateRows();
    expect(updates).toHaveLength(1);
    expect(updates[0]).toMatchObject({ status: 'queued', started_at: null, attempt_count: 2 });
    const events = sb._calls().filter((c: any) => c.table === 'activity_log');
    expect(events).toHaveLength(1);
    expect(events[0].row.event_type).toBe('ai_analysis_orphan_reclaimed');
  });

  it('fails the job (attempt_count >= 3): sets status=failed with error_detail.reason="orphaned_by_restart"', async () => {
    const sb = makeFakeSupabase();
    sb._stuckJobs.push({ id: 'job2', attempt_count: 3 });
    await sweepStuckJobs(sb);
    const updates = sb._updateRows();
    expect(updates).toHaveLength(1);
    expect(updates[0].status).toBe('failed');
    expect(updates[0].error_detail).toEqual({ reason: 'orphaned_by_restart', attempts: 3 });
    expect(updates[0].completed_at).toBeTruthy();
    const events = sb._calls().filter((c: any) => c.table === 'activity_log');
    expect(events).toHaveLength(1);
    expect(events[0].row.event_type).toBe('ai_analysis_failed');
  });

  it('processes multiple stuck jobs in one sweep', async () => {
    const sb = makeFakeSupabase();
    sb._stuckJobs.push({ id: 'a', attempt_count: 0 });
    sb._stuckJobs.push({ id: 'b', attempt_count: 3 });
    sb._stuckJobs.push({ id: 'c', attempt_count: 1 });
    await sweepStuckJobs(sb);
    expect(sb._updateRows()).toHaveLength(3);
    const events = sb._calls().filter((c: any) => c.table === 'activity_log');
    expect(events).toHaveLength(3);
    expect(events.map((e: any) => e.row.event_type).sort()).toEqual([
      'ai_analysis_failed',
      'ai_analysis_orphan_reclaimed',
      'ai_analysis_orphan_reclaimed',
    ]);
  });
});
