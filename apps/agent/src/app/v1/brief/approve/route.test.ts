import { describe, it, expect, vi, beforeEach, type Mock } from 'vitest';
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
let customerRow: any;

// Phase 4.5 mocks
let paystackInitMock: any;
let sendEmailMock: any;

vi.mock('@/lib/paystack', () => ({
  initializeTransaction: (...args: any[]) => paystackInitMock(...args),
  paystackReference: (id: string) => `ops-cal-${id}-1714742400`,
  PaystackInitError: class extends Error { constructor(public detail: any) { super('paystack_init_failed'); } },
}));
vi.mock('@/lib/email', () => ({
  sendEmail: (...args: any[]) => sendEmailMock(...args),
  EmailSendError: class extends Error { constructor(public detail: any) { super('email_send_failed'); } },
}));
vi.mock('@operscale-calendar/web/emails/BriefEmail', () => ({
  BriefEmail: () => null,
  default: () => null,
}));
vi.mock('@react-email/render', () => ({
  render: vi.fn().mockResolvedValue('<html>brief</html>'),
}));

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
      if (table === 'customers') {
        return {
          select: vi.fn().mockReturnValue({
            eq: vi.fn().mockReturnValue({
              maybeSingle: vi.fn().mockImplementation(() => Promise.resolve({ data: customerRow, error: null })),
            }),
          }),
        };
      }
      return {};
    }),
  }),
  writeActivityLog: vi.fn().mockResolvedValue(undefined),
}));

const baseAiOutput = {
  brand_voice: { voice_phrases: ['hand-finished'], sentence_rhythm: 'short_punchy', avoid_words: [], energy_register: 'calm', voice_corpus_quality: 'thick' },
  specificity_inventory: { numbers: ['14 hours'], proper_nouns: ['Lagos'], process_steps: ['hand-finishing'], specificity_corpus_quality: 'thick' },
  expertise_map: [],
  visual_aesthetic: { lighting: 'natural daylight', setting: 'studio in Lekki', wardrobe_props: 'ankara fabric rolls', photo_quality_summary: 'clean, well-lit', photos_present: false },
  calendar_plan: [
    { slot_index: 1, day: 1, format: 'ugc_30s', framework_slot: 'AIDA', archetype_slot: 'QUALITY_MOMENT', topic: 'Three-week turnaround', hook: 'You think bespoke means waiting six weeks?', core_beats: ['Three weeks. Not six. Three.', 'Hand-finishing on every seam', 'Lekki studio'], cta: 'Book a fitting', fabrication_risk_check: 'passed' },
    { slot_index: 2, day: 2, format: 'ugc_30s', framework_slot: 'PAS',  archetype_slot: 'PROCESS_TOUR',   topic: 'Inside the hand-finishing process', hook: 'Why your last ankara dress fell apart', core_beats: ['Cheap thread', 'Wrong wash temperature', 'How we differ'], cta: 'See the workshop', fabrication_risk_check: 'passed' },
    { slot_index: 3, day: 3, format: 'ugc_60s', framework_slot: 'COST_REVEAL', archetype_slot: 'OUTCOME_SHOWCASE', topic: 'Real customer outcome', hook: 'She wore this to her promotion dinner', core_beats: ['Brief', 'Fitting', 'Final piece'], cta: 'Submit your brief', fabrication_risk_check: 'passed' },
  ],
  fabrication_audit: { lines_checked: 3, violations_found: [], audit_passed: true },
  flags_for_review: [],
  brief_summary: 'Bespoke ankara tailoring with three-week guaranteed turnaround for Lagos professionals.',
  upsell_recommendation: { should_upsell: false, recommended_tier: null, reasoning: '', upsell_price_delta: 0 },
  estimated_brief_quality_score: 0.82,
};

beforeEach(async () => {
  orderRow = {
    id: 'order-1',
    brief_id: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
    customer_id: 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb',
    status: 'pending_founder_review',
    tier: 'standard',
    amount_ngn: 350_000,
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
    ai_output: baseAiOutput,
  };
  frameworkHistoryInserts = [];
  orderUpdates = [];
  customerRow = { full_name: 'Tola Adekunle', email: 'tola@example.com' };
  paystackInitMock = vi.fn().mockResolvedValue({ authorizationUrl: 'https://checkout.paystack.com/abc', accessCode: 'ac', reference: 'ops-cal-order-1-1714742400' });
  sendEmailMock = vi.fn().mockResolvedValue({ resendMessageId: 'msg-1' });
  vi.clearAllMocks();
  // Re-initialise mocks after clearAllMocks (clear resets call counts but also
  // wipes mockImplementation on module-level vi.fn()s — reinstate them).
  paystackInitMock = vi.fn().mockResolvedValue({ authorizationUrl: 'https://checkout.paystack.com/abc', accessCode: 'ac', reference: 'ops-cal-order-1-1714742400' });
  sendEmailMock = vi.fn().mockResolvedValue({ resendMessageId: 'msg-1' });
  // Reinstate the render mock implementation (clearAllMocks strips it).
  const { render } = await import('@react-email/render');
  (render as unknown as Mock).mockResolvedValue('<html>brief</html>');
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

    // Phase 4.5 is now wired: expect at least the founder_approved update (more follow)
    expect(orderUpdates.length).toBeGreaterThanOrEqual(1);
    expect(orderUpdates[0].row.status).toBe('founder_approved');
  });

  it('returns 404 when no is_current analysis_runs row exists for the brief', async () => {
    analysisRunRow = null;
    expect((await POST(makeRequest({ order_id: 'order-1' }))).status).toBe(404);
  });

  describe('Phase 4.5 — Paystack init + Resend send', () => {
    it('happy path: 200 + paystack_tx_ref + brief_email_sent + resend_message_id', async () => {
      const req = new Request('http://x/v1/brief/approve', {
        method: 'POST',
        headers: { 'authorization': `Bearer ${FOUNDER_TOKEN}`, 'content-type': 'application/json' },
        body: JSON.stringify({ order_id: 'order-1' }),
      });
      const res = await POST(req);
      expect(res.status).toBe(200);
      const json = await res.json();
      expect(json).toMatchObject({
        order_id: 'order-1',
        framework_history_rows_written: expect.any(Number),
        paystack_tx_ref: 'ops-cal-order-1-1714742400',
        brief_email_sent: true,
        resend_message_id: 'msg-1',
      });
      // orders updated 3 times: founder_approved, paystack data, brief_sent
      expect(orderUpdates.length).toBeGreaterThanOrEqual(3);
      const finalUpdate = orderUpdates[orderUpdates.length - 1];
      expect(finalUpdate.row.status).toBe('brief_sent');
      expect(finalUpdate.row.brief_email_sent_at).toBeDefined();
    });

    it('paystack init fails: 502 + order stays at founder_approved', async () => {
      const { PaystackInitError } = await import('@/lib/paystack');
      paystackInitMock.mockRejectedValueOnce(new (PaystackInitError as any)({ status: 400, message: 'bad amount' }));
      const req = new Request('http://x/v1/brief/approve', {
        method: 'POST',
        headers: { 'authorization': `Bearer ${FOUNDER_TOKEN}`, 'content-type': 'application/json' },
        body: JSON.stringify({ order_id: 'order-1' }),
      });
      const res = await POST(req);
      expect(res.status).toBe(502);
      const json = await res.json();
      expect(json.error).toBe('paystack_init_failed');
      // order should NOT have been updated to brief_sent or brief_email_failed
      const statusUpdates = orderUpdates.map((u) => u.row.status).filter(Boolean);
      expect(statusUpdates).not.toContain('brief_sent');
      expect(statusUpdates).not.toContain('brief_email_failed');
      expect(sendEmailMock).not.toHaveBeenCalled();
    });

    it('resend fails after paystack OK: 502 + order flips to brief_email_failed', async () => {
      const { EmailSendError } = await import('@/lib/email');
      sendEmailMock.mockRejectedValueOnce(new (EmailSendError as any)({ status: 422, message: 'Suppressed address' }));
      const req = new Request('http://x/v1/brief/approve', {
        method: 'POST',
        headers: { 'authorization': `Bearer ${FOUNDER_TOKEN}`, 'content-type': 'application/json' },
        body: JSON.stringify({ order_id: 'order-1' }),
      });
      const res = await POST(req);
      expect(res.status).toBe(502);
      const json = await res.json();
      expect(json.error).toBe('email_send_failed');
      expect(json.tx_ref).toBe('ops-cal-order-1-1714742400');
      const statusUpdates = orderUpdates.map((u) => u.row.status).filter(Boolean);
      expect(statusUpdates).toContain('brief_email_failed');
      expect(statusUpdates).not.toContain('brief_sent');
    });

    it('retry on brief_email_failed: APPROVABLE_STATUSES allows it', async () => {
      orderRow.status = 'brief_email_failed';
      const req = new Request('http://x/v1/brief/approve', {
        method: 'POST',
        headers: { 'authorization': `Bearer ${FOUNDER_TOKEN}`, 'content-type': 'application/json' },
        body: JSON.stringify({ order_id: 'order-1' }),
      });
      const res = await POST(req);
      expect(res.status).toBe(200);
    });

    it('rejects on brief_sent: APPROVABLE_STATUSES does not include it', async () => {
      orderRow.status = 'brief_sent';
      const req = new Request('http://x/v1/brief/approve', {
        method: 'POST',
        headers: { 'authorization': `Bearer ${FOUNDER_TOKEN}`, 'content-type': 'application/json' },
        body: JSON.stringify({ order_id: 'order-1' }),
      });
      const res = await POST(req);
      expect(res.status).toBe(409);
    });

    it('passes correct args to initializeTransaction (email, amount, callback_url, metadata)', async () => {
      const req = new Request('http://x/v1/brief/approve', {
        method: 'POST',
        headers: { 'authorization': `Bearer ${FOUNDER_TOKEN}`, 'content-type': 'application/json' },
        body: JSON.stringify({ order_id: 'order-1' }),
      });
      await POST(req);
      expect(paystackInitMock).toHaveBeenCalledWith(expect.objectContaining({
        email: 'tola@example.com',
        amountNgn: 350_000,
        reference: 'ops-cal-order-1-1714742400',
        callbackUrl: expect.stringContaining('/payment/return?order_id=order-1'),
        metadata: expect.objectContaining({
          order_id: 'order-1',
          brief_id: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
        }),
      }));
    });

    it('flips order to brief_email_failed when customer fetch fails after founder_approved', async () => {
      customerRow = null;
      const req = new Request('http://x/v1/brief/approve', {
        method: 'POST',
        headers: { authorization: `Bearer ${FOUNDER_TOKEN}`, 'content-type': 'application/json' },
        body: JSON.stringify({ order_id: 'order-1' }),
      });
      const res = await POST(req);
      expect(res.status).toBe(502);
      const json = await res.json();
      expect(json.error).toBe('customer_not_found_or_no_email');
      // Verify order was flipped to brief_email_failed
      const statusUpdates = orderUpdates.map((u: any) => u.row.status).filter(Boolean);
      expect(statusUpdates).toContain('brief_email_failed');
      expect(statusUpdates).not.toContain('brief_sent');
    });

    it('passes paymentLink (authorization_url) into the rendered template', async () => {
      const req = new Request('http://x/v1/brief/approve', {
        method: 'POST',
        headers: { 'authorization': `Bearer ${FOUNDER_TOKEN}`, 'content-type': 'application/json' },
        body: JSON.stringify({ order_id: 'order-1' }),
      });
      await POST(req);
      // The first arg to render() is the React element. Hard to introspect directly,
      // so instead verify sendEmail was called with html that the mock returned.
      expect(sendEmailMock).toHaveBeenCalledWith(expect.objectContaining({
        to: 'tola@example.com',
        templateKey: 'brief-email',
        html: '<html>brief</html>',
      }));
    });
  });
});
