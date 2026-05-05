import { describe, it, expect, vi, beforeEach } from 'vitest';
import { POST } from './route';

const FOUNDER_TOKEN = (() => {
  const header = Buffer.from(JSON.stringify({ alg: 'HS256', typ: 'JWT' })).toString('base64url');
  const body = Buffer.from(JSON.stringify({ role: 'founder', sub: 'founder-1' })).toString('base64url');
  return `${header}.${body}.sig`;
})();
const SERVICE_TOKEN = (() => {
  const header = Buffer.from(JSON.stringify({ alg: 'HS256', typ: 'JWT' })).toString('base64url');
  const body = Buffer.from(JSON.stringify({ role: 'service_role', sub: 'system' })).toString('base64url');
  return `${header}.${body}.sig`;
})();

let supabaseInsertMock: any;
let supabaseSelectMock: any;

vi.mock('@/lib/supabase-admin', () => ({
  getSupabaseAdmin: () => ({
    from: vi.fn((table: string) => {
      if (table === 'ai_analysis_jobs') {
        return {
          select: vi.fn().mockReturnValue({
            eq: vi.fn().mockReturnValue({
              maybeSingle: vi.fn().mockImplementation(() => supabaseSelectMock()),
            }),
          }),
          insert: vi.fn().mockImplementation((row: any) => ({
            select: vi.fn().mockReturnValue({
              maybeSingle: vi.fn().mockImplementation(() => supabaseInsertMock(row)),
            }),
          })),
        };
      }
      if (table === 'analysis_runs') {
        return {
          select: vi.fn().mockReturnValue({
            eq: vi.fn().mockReturnValue({
              eq: vi.fn().mockReturnValue({
                maybeSingle: vi.fn().mockResolvedValue({ data: { run_index: 2 }, error: null }),
              }),
            }),
          }),
        };
      }
      return {};
    }),
  }),
  writeActivityLog: vi.fn().mockResolvedValue(undefined),
}));

beforeEach(() => {
  supabaseInsertMock = vi.fn().mockResolvedValue({ data: { id: 'new-job-id' }, error: null });
  supabaseSelectMock = vi.fn().mockResolvedValue({ data: null, error: null });
});

function makeRequest(body: any, token = FOUNDER_TOKEN): Request {
  return new Request('http://localhost/v1/brief/analyze', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
    body: JSON.stringify(body),
  });
}

describe('POST /v1/brief/analyze', () => {
  it('returns 401 when Authorization is missing', async () => {
    const req = new Request('http://localhost/v1/brief/analyze', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ brief_id: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa' }),
    });
    const res = await POST(req);
    expect(res.status).toBe(401);
  });

  it('returns 400 when brief_id is missing or not a UUID', async () => {
    const res = await POST(makeRequest({ brief_id: 'not-a-uuid' }));
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body).toMatchObject({ error: expect.stringContaining('brief_id') });
  });

  it('enqueues an initial job and returns 202 with the new job_id', async () => {
    const res = await POST(
      makeRequest({ brief_id: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa' }, SERVICE_TOKEN),
    );
    expect(res.status).toBe(202);
    const body = await res.json();
    expect(body).toMatchObject({ job_id: 'new-job-id', status: 'queued' });
    expect(body.idempotency_key).toBe('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa::initial::0');
  });

  it('returns 200 with the existing job_id on idempotency_key conflict', async () => {
    supabaseInsertMock = vi.fn().mockResolvedValue({
      data: null,
      error: { code: '23505', message: 'duplicate key' },
    });
    supabaseSelectMock = vi.fn().mockResolvedValue({
      data: { id: 'existing-job-id', status: 'completed' },
      error: null,
    });
    const res = await POST(
      makeRequest({ brief_id: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa' }, SERVICE_TOKEN),
    );
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body).toMatchObject({ job_id: 'existing-job-id', status: 'completed' });
  });

  it('returns 400 when re_analyze_* trigger_type is missing founder_note or prior_run_id', async () => {
    const res = await POST(
      makeRequest({
        brief_id: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
        trigger_type: 're_analyze_same_frameworks',
      }),
    );
    expect(res.status).toBe(400);
  });

  it('enqueues a re_analyze_same_frameworks job with prior_run_index from prior run', async () => {
    const res = await POST(
      makeRequest({
        brief_id: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
        trigger_type: 're_analyze_same_frameworks',
        founder_note: 'tighten the hooks',
        prior_run_id: 'cccccccc-cccc-4ccc-8ccc-cccccccccccc',
      }),
    );
    expect(res.status).toBe(202);
    const body = await res.json();
    expect(body.idempotency_key).toBe(
      'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa::re_analyze_same_frameworks::2',
    );
  });

  it('returns 403 when a non-founder, non-service JWT calls a re_analyze_* trigger', async () => {
    const customerToken = (() => {
      const h = Buffer.from(JSON.stringify({ alg: 'HS256', typ: 'JWT' })).toString('base64url');
      const b = Buffer.from(JSON.stringify({ role: 'authenticated', sub: 'cust-1' })).toString('base64url');
      return `${h}.${b}.sig`;
    })();
    const res = await POST(
      makeRequest(
        {
          brief_id: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
          trigger_type: 're_analyze_new_frameworks',
          founder_note: 'tweak',
          prior_run_id: 'cccccccc-cccc-4ccc-8ccc-cccccccccccc',
        },
        customerToken,
      ),
    );
    expect(res.status).toBe(403);
  });
});
