import { describe, expect, it, vi, beforeEach } from 'vitest';
import { POST } from './route';

const mockSelectMaybeSingle = vi.fn();
const mockUpdate = vi.fn();
const mockWriteActivityLog = vi.fn();

vi.mock('@/lib/supabase-admin', () => ({
  getSupabaseAdmin: () => ({
    from: (table: string) => ({
      select: () => ({
        eq: () => ({
          maybeSingle: mockSelectMaybeSingle,
        }),
      }),
      update: mockUpdate.mockReturnValue({
        eq: () => Promise.resolve({ error: null }),
      }),
    }),
  }),
  writeActivityLog: (...args: unknown[]) => mockWriteActivityLog(...args),
}));

const FOUNDER_JWT_HEADER = `Bearer ${Buffer.from(JSON.stringify({ alg: 'HS256' })).toString(
  'base64url',
)}.${Buffer.from(JSON.stringify({ role: 'founder', sub: 'founder-uuid' })).toString(
  'base64url',
)}.signature`;

const NON_FOUNDER_JWT = `Bearer ${Buffer.from(JSON.stringify({ alg: 'HS256' })).toString(
  'base64url',
)}.${Buffer.from(JSON.stringify({ role: 'authenticated', sub: 'someone' })).toString(
  'base64url',
)}.signature`;

function makeRequest(body: unknown, jwtHeader?: string): Request {
  const headers: Record<string, string> = { 'content-type': 'application/json' };
  if (jwtHeader) headers['Authorization'] = jwtHeader;
  return new Request('http://localhost:3002/v1/brief/discard', {
    method: 'POST',
    headers,
    body: JSON.stringify(body),
  });
}

beforeEach(() => {
  mockSelectMaybeSingle.mockReset();
  mockUpdate.mockReset().mockReturnValue({ eq: () => Promise.resolve({ error: null }) });
  mockWriteActivityLog.mockReset().mockResolvedValue(undefined);
});

describe('POST /v1/brief/discard', () => {
  it('returns 401 when Authorization header is missing', async () => {
    const res = await POST(makeRequest({ order_id: 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa' }));
    expect(res.status).toBe(401);
  });

  it('returns 403 when role is not founder', async () => {
    const res = await POST(
      makeRequest({ order_id: 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa' }, NON_FOUNDER_JWT),
    );
    expect(res.status).toBe(403);
  });

  it('returns 400 when order_id is missing', async () => {
    const res = await POST(makeRequest({}, FOUNDER_JWT_HEADER));
    expect(res.status).toBe(400);
  });

  it('returns 400 when order_id is not a uuid', async () => {
    const res = await POST(makeRequest({ order_id: 'not-a-uuid' }, FOUNDER_JWT_HEADER));
    expect(res.status).toBe(400);
  });

  it('returns 400 when reason exceeds 500 chars', async () => {
    const res = await POST(
      makeRequest(
        {
          order_id: 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa',
          reason: 'x'.repeat(501),
        },
        FOUNDER_JWT_HEADER,
      ),
    );
    expect(res.status).toBe(400);
  });

  it('returns 404 when order is not found', async () => {
    mockSelectMaybeSingle.mockResolvedValueOnce({ data: null, error: null });
    const res = await POST(
      makeRequest({ order_id: 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa' }, FOUNDER_JWT_HEADER),
    );
    expect(res.status).toBe(404);
  });

  it('returns 409 when status is not pending_founder_review', async () => {
    mockSelectMaybeSingle.mockResolvedValueOnce({
      data: {
        id: 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa',
        brief_id: 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb',
        status: 'paid',
      },
      error: null,
    });
    const res = await POST(
      makeRequest({ order_id: 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa' }, FOUNDER_JWT_HEADER),
    );
    expect(res.status).toBe(409);
    const body = await res.json();
    expect(body.current_status).toBe('paid');
  });

  it('happy path returns 200 + UPDATEs status + writes activity_log with reason', async () => {
    mockSelectMaybeSingle.mockResolvedValueOnce({
      data: {
        id: 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa',
        brief_id: 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb',
        status: 'pending_founder_review',
      },
      error: null,
    });
    const res = await POST(
      makeRequest(
        {
          order_id: 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa',
          reason: 'spam submission',
        },
        FOUNDER_JWT_HEADER,
      ),
    );
    expect(res.status).toBe(200);
    expect(mockUpdate).toHaveBeenCalledTimes(1);
    expect(mockWriteActivityLog).toHaveBeenCalledWith(
      expect.objectContaining({
        eventType: 'founder_discarded',
        actor: 'founder',
        briefId: 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb',
        payload: expect.objectContaining({
          order_id: 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa',
          reason: 'spam submission',
        }),
      }),
      expect.anything(),
    );
  });

  it('returns 500 + writes discard_failed activity_log when UPDATE fails', async () => {
    mockSelectMaybeSingle.mockResolvedValueOnce({
      data: {
        id: 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa',
        brief_id: 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb',
        status: 'pending_founder_review',
      },
      error: null,
    });
    mockUpdate.mockReturnValueOnce({
      eq: () => Promise.resolve({ error: { message: 'simulated db failure' } }),
    });
    const res = await POST(
      makeRequest({ order_id: 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa' }, FOUNDER_JWT_HEADER),
    );
    expect(res.status).toBe(500);
    expect(mockWriteActivityLog).toHaveBeenCalledWith(
      expect.objectContaining({ eventType: 'discard_failed' }),
      expect.anything(),
    );
  });
});
