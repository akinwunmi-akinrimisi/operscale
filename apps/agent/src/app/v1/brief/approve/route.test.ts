import { describe, it, expect, vi, beforeEach } from 'vitest';
import { POST } from './route';

const FOUNDER_TOKEN = (() => {
  const h = Buffer.from(JSON.stringify({ alg: 'HS256', typ: 'JWT' })).toString('base64url');
  const b = Buffer.from(JSON.stringify({ role: 'founder', sub: 'founder-1' })).toString('base64url');
  return `${h}.${b}.sig`;
})();

let orderRow: any;
let analysisRunRow: any;
let frameworkHistoryInserts: any[];
let orderUpdates: any[];

vi.mock('@/lib/supabase-admin', () => ({
  getSupabaseAdmin: () => ({
    from: vi.fn((table: string) => {
      if (table === 'orders') {
        return {
          select: vi.fn().mockReturnValue({
            eq: vi.fn().mockReturnValue({
              maybeSingle: vi.fn().mockImplementation(() => Promise.resolve({ data: orderRow, error: null })),
            }),
          }),
          update: vi.fn().mockImplementation((row: any) => ({
            eq: vi.fn().mockImplementation(async (col: string, val: any) => {
              orderUpdates.push({ row, where: { [col]: val } });
              return { error: null };
            }),
          })),
        };
      }
      if (table === 'analysis_runs') {
        return {
          select: vi.fn().mockReturnValue({
            eq: vi.fn().mockReturnValue({
              eq: vi.fn().mockReturnValue({
                maybeSingle: vi.fn().mockImplementation(() => Promise.resolve({ data: analysisRunRow, error: null })),
              }),
            }),
          }),
        };
      }
      if (table === 'customer_framework_history') {
        return {
          insert: vi.fn().mockImplementation(async (rows: any[]) => {
            frameworkHistoryInserts.push(rows);
            return { error: null };
          }),
        };
      }
      return {};
    }),
  }),
  writeActivityLog: vi.fn().mockResolvedValue(undefined),
}));

beforeEach(() => {
  orderRow = {
    id: 'order-1',
    brief_id: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
    customer_id: 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb',
    status: 'pending_founder_review',
  };
  analysisRunRow = {
    id: 'run-1',
    brief_id: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
    framework_seed: {
      seed_hash: 'h',
      selected_pairs: [
        { framework: 'DR_FORMULA', archetype: 'PRICING_BREAKDOWN' },
        { framework: 'PAS', archetype: 'SERVICE_ANATOMY' },
        { framework: 'AIDA', archetype: 'PRODUCT_TOUR' },
      ],
    },
  };
  frameworkHistoryInserts = [];
  orderUpdates = [];
});

function makeRequest(body: any, token = FOUNDER_TOKEN): Request {
  return new Request('http://localhost/v1/brief/approve', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
    body: JSON.stringify(body),
  });
}

describe('POST /v1/brief/approve', () => {
  it('returns 401 when Authorization is missing', async () => {
    const req = new Request('http://localhost/v1/brief/approve', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ order_id: 'order-1' }),
    });
    expect((await POST(req)).status).toBe(401);
  });

  it('returns 403 when JWT role is not founder', async () => {
    const customerToken = (() => {
      const h = Buffer.from(JSON.stringify({ alg: 'HS256', typ: 'JWT' })).toString('base64url');
      const b = Buffer.from(JSON.stringify({ role: 'authenticated' })).toString('base64url');
      return `${h}.${b}.sig`;
    })();
    expect((await POST(makeRequest({ order_id: 'order-1' }, customerToken))).status).toBe(403);
  });

  it('returns 400 when order_id is missing', async () => {
    expect((await POST(makeRequest({}))).status).toBe(400);
  });

  it('returns 404 when order is not found', async () => {
    orderRow = null;
    expect((await POST(makeRequest({ order_id: 'order-x' }))).status).toBe(404);
  });

  it('returns 409 when order.status is not in approvable set', async () => {
    orderRow.status = 'paid';
    const res = await POST(makeRequest({ order_id: 'order-1' }));
    expect(res.status).toBe(409);
  });

  it('writes one customer_framework_history row per selected_pair and flips order status', async () => {
    const res = await POST(makeRequest({ order_id: 'order-1' }));
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body).toMatchObject({ order_id: 'order-1', framework_history_rows_written: 3 });

    expect(frameworkHistoryInserts).toHaveLength(1);
    expect(frameworkHistoryInserts[0]).toHaveLength(3);
    expect(frameworkHistoryInserts[0][0]).toMatchObject({
      customer_id: 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb',
      order_id: 'order-1',
      framework_slot: 'DR_FORMULA',
      archetype_slot: 'PRICING_BREAKDOWN',
    });

    expect(orderUpdates).toHaveLength(1);
    expect(orderUpdates[0].row.status).toBe('founder_approved');
  });

  it('returns 404 when no is_current analysis_runs row exists for the brief', async () => {
    analysisRunRow = null;
    expect((await POST(makeRequest({ order_id: 'order-1' }))).status).toBe(404);
  });
});
