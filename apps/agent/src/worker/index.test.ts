import { describe, it, expect, vi, afterEach } from 'vitest';
import { startWorker, type WorkerHandle } from './index';

describe('startWorker', () => {
  let handle: WorkerHandle | null = null;

  afterEach(async () => {
    if (handle) await handle.shutdown();
    handle = null;
  });

  it('starts and reports running=true; shutdown flips it to false', async () => {
    const supabase: any = {
      from: vi.fn().mockReturnValue({ insert: vi.fn().mockResolvedValue({ error: null }) }),
    };
    const analyzer: any = { analyze: vi.fn() };
    const claimNextJob = vi.fn().mockResolvedValue(null);
    const sweepStuckJobs = vi.fn().mockResolvedValue(undefined);
    handle = startWorker({
      supabase,
      analyzer,
      claimNextJob,
      sweepStuckJobs,
      logger: { info: vi.fn(), error: vi.fn() },
      pollIntervalMs: 50,
      heartbeatIntervalMs: 50,
      sweepIntervalMs: 50,
    });
    expect(handle.isRunning()).toBe(true);
    await new Promise((r) => setTimeout(r, 120));
    await handle.shutdown();
    expect(handle.isRunning()).toBe(false);
  });

  it('writes a worker_heartbeat activity_log row at the configured interval', async () => {
    const inserts: any[] = [];
    const supabase: any = {
      from: vi.fn().mockImplementation((table: string) => ({
        insert: vi.fn().mockImplementation(async (row: any) => {
          inserts.push({ table, row });
          return { error: null };
        }),
      })),
    };
    const analyzer: any = { analyze: vi.fn() };
    const claimNextJob = vi.fn().mockResolvedValue(null);
    const sweepStuckJobs = vi.fn().mockResolvedValue(undefined);
    handle = startWorker({
      supabase,
      analyzer,
      claimNextJob,
      sweepStuckJobs,
      logger: { info: vi.fn(), error: vi.fn() },
      pollIntervalMs: 1000,
      heartbeatIntervalMs: 50,
      sweepIntervalMs: 1000,
    });
    await new Promise((r) => setTimeout(r, 175));
    await handle.shutdown();
    const heartbeats = inserts.filter(
      (i) => i.table === 'activity_log' && i.row.event_type === 'worker_heartbeat',
    );
    expect(heartbeats.length).toBeGreaterThanOrEqual(2);
  });

  it('runs sweepStuckJobs once on bootstrap and at sweepIntervalMs cadence', async () => {
    const supabase: any = {
      from: vi.fn().mockReturnValue({ insert: vi.fn().mockResolvedValue({ error: null }) }),
    };
    const analyzer: any = { analyze: vi.fn() };
    const claimNextJob = vi.fn().mockResolvedValue(null);
    const sweepStuckJobs = vi.fn().mockResolvedValue(undefined);
    handle = startWorker({
      supabase,
      analyzer,
      claimNextJob,
      sweepStuckJobs,
      logger: { info: vi.fn(), error: vi.fn() },
      pollIntervalMs: 1000,
      heartbeatIntervalMs: 1000,
      sweepIntervalMs: 50,
    });
    await new Promise((r) => setTimeout(r, 175));
    await handle.shutdown();
    expect(sweepStuckJobs.mock.calls.length).toBeGreaterThanOrEqual(2);
  });
});
