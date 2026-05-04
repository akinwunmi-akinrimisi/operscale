// Root page. Anyone hitting api.operscale.cloud / directly gets a self-describing
// status page with the API surface map. Reduces "what is this 405?" support load.

const ROUTES: { method: 'GET' | 'POST'; path: string; status: 'live' | 'stub'; note: string }[] = [
  { method: 'GET',  path: '/v1/health',                     status: 'live', note: 'Liveness probe' },
  { method: 'POST', path: '/v1/brief/submit',                status: 'stub', note: 'Form submission' },
  { method: 'POST', path: '/v1/brief/upload-photo',          status: 'stub', note: 'Photo upload (multipart)' },
  { method: 'POST', path: '/v1/brief/analyze',               status: 'stub', note: 'AI brief analysis (Claude)' },
  { method: 'POST', path: '/v1/brief/reanalyze',             status: 'stub', note: 'Re-analyze with founder note' },
  { method: 'POST', path: '/v1/brief/edit-field',            status: 'stub', note: 'Inline-edit save' },
  { method: 'POST', path: '/v1/brief/approve',               status: 'stub', note: 'Founder approval + brief email' },
  { method: 'POST', path: '/v1/brief/discard',               status: 'stub', note: 'Founder discard' },
  { method: 'POST', path: '/v1/payment/initialize',          status: 'stub', note: 'Paystack transaction init' },
  { method: 'POST', path: '/v1/webhook/paystack',            status: 'stub', note: 'Paystack webhook (HMAC-SHA512)' },
  { method: 'POST', path: '/v1/webhook/resend-inbound',      status: 'stub', note: 'Resend bounce/inbound webhook' },
  { method: 'POST', path: '/v1/webhook/evolution',           status: 'stub', note: 'WhatsApp inbound webhook' },
  { method: 'GET',  path: '/v1/admin/photo-signed-url',      status: 'stub', note: 'Mint 5-min signed URL' },
  { method: 'POST', path: '/v1/admin/photo-delete',          status: 'stub', note: 'Founder photo override delete' },
  { method: 'GET',  path: '/v1/admin/orders',                status: 'stub', note: 'Order list (RLS-protected)' },
];

export default function RootPage() {
  const fontStack = 'system-ui,-apple-system,Segoe UI,Roboto,Helvetica,Arial,sans-serif';
  const monoStack = 'ui-monospace,SFMono-Regular,Menlo,monospace';
  return (
    <main style={{ fontFamily: fontStack, padding: '2rem', maxWidth: 920, margin: '0 auto', color: '#111' }}>
      <h1 style={{ marginTop: 0 }}>Operscale Calendar — Agent</h1>
      <p style={{ color: '#555' }}>
        Internal API service. Not for browser use. The customer-facing site is{' '}
        <a href="https://operscale.cloud/">operscale.cloud</a>.
      </p>
      <p style={{ color: '#555' }}>
        Most endpoints below are <code>POST</code>-only. A browser GET will return{' '}
        <strong>405 Method Not Allowed</strong> — that is the correct HTTP response,
        not an error in the service. The webhooks are called by Paystack, Resend,
        and the Evolution API server-to-server.
      </p>

      <h2 style={{ marginTop: '2rem', fontSize: '1.1rem' }}>API surface</h2>
      <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 14 }}>
        <thead>
          <tr style={{ textAlign: 'left', borderBottom: '1px solid #ddd' }}>
            <th style={{ padding: '8px 6px' }}>Method</th>
            <th style={{ padding: '8px 6px' }}>Path</th>
            <th style={{ padding: '8px 6px' }}>Status</th>
            <th style={{ padding: '8px 6px' }}>Purpose</th>
          </tr>
        </thead>
        <tbody>
          {ROUTES.map((r) => (
            <tr key={r.path} style={{ borderBottom: '1px solid #f0f0f0' }}>
              <td style={{ padding: '6px', fontFamily: monoStack, color: r.method === 'GET' ? '#0a7' : '#06f' }}>
                {r.method}
              </td>
              <td style={{ padding: '6px', fontFamily: monoStack }}>{r.path}</td>
              <td style={{ padding: '6px', color: r.status === 'live' ? '#0a7' : '#888' }}>
                {r.status === 'live' ? '200 live' : '501 stub'}
              </td>
              <td style={{ padding: '6px', color: '#555' }}>{r.note}</td>
            </tr>
          ))}
        </tbody>
      </table>

      <p style={{ color: '#888', fontSize: 12, marginTop: '2rem' }}>
        Stubs return <code>{`{"status":"not_implemented","spec":"docs/specs/<spec>.md"}`}</code>{' '}
        with HTTP 501. Implementation per <code>docs/implementation.md</code>.
      </p>
    </main>
  );
}
