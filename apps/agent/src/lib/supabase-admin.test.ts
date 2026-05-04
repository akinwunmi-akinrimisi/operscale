import { describe, it, expect, vi, beforeEach } from 'vitest';

describe('writeActivityLog', () => {
  beforeEach(() => {
    vi.resetModules();
  });

  it('inserts a row into activity_log with the provided fields', async () => {
    const insert = vi.fn().mockResolvedValue({ error: null });
    const from = vi.fn().mockReturnValue({ insert });
    const fakeClient = { from };

    const { writeActivityLog } = await import('./supabase-admin');
    await writeActivityLog(
      {
        eventType: 'ai_analysis_started',
        actor: 'system',
        briefId: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
        payload: { trigger_type: 'initial', seed_hash: 'abc123' },
      },
      fakeClient as any,
    );

    expect(from).toHaveBeenCalledWith('activity_log');
    expect(insert).toHaveBeenCalledOnce();
    const row = insert.mock.calls[0][0];
    expect(row.event_type).toBe('ai_analysis_started');
    expect(row.actor).toBe('system');
    expect(row.brief_id).toBe('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa');
    expect(row.payload).toEqual({ trigger_type: 'initial', seed_hash: 'abc123' });
  });

  it('does NOT throw when supabase insert returns an error — best-effort writes per CLAUDE.md gotcha #11', async () => {
    const insert = vi.fn().mockResolvedValue({ error: { message: 'insert failed' } });
    const from = vi.fn().mockReturnValue({ insert });
    const fakeClient = { from };

    const { writeActivityLog } = await import('./supabase-admin');
    await expect(
      writeActivityLog(
        { eventType: 'ai_analysis_failed', actor: 'system' },
        fakeClient as any,
      ),
    ).resolves.toBeUndefined();
  });

  it('writes the audit-log row even when payload is omitted (sets {} default)', async () => {
    const insert = vi.fn().mockResolvedValue({ error: null });
    const from = vi.fn().mockReturnValue({ insert });
    const fakeClient = { from };

    const { writeActivityLog } = await import('./supabase-admin');
    await writeActivityLog({ eventType: 'worker_heartbeat', actor: 'system' }, fakeClient as any);

    const row = insert.mock.calls[0][0];
    expect(row.payload).toEqual({});
  });
});

describe('assertServerSide', () => {
  beforeEach(() => {
    vi.resetModules();
  });

  it('does not throw when window is undefined (server-side)', async () => {
    const { assertServerSide } = await import('./supabase-admin');
    // In Vitest's node environment window is undefined.
    expect(() => assertServerSide()).not.toThrow();
  });

  it('throws at module load when window is defined (browser context)', async () => {
    // Inject a global `window` to simulate browser-side import. The module's
    // top-level `assertServerSide()` call should fire during import itself,
    // so the import promise rejects — strongest possible guard.
    const origWindow = (globalThis as any).window;
    (globalThis as any).window = { document: {} };
    try {
      vi.resetModules();
      await expect(import('./supabase-admin')).rejects.toThrow(/server-side|service.role|browser/i);
    } finally {
      (globalThis as any).window = origWindow;
    }
  });
});
