// /v1/setup/whatsapp-qr
//
// One-time WhatsApp pairing page for the operscale-calendar Evolution instance.
// Renders the live QR as an <img> with auto-refresh every 25s (under the QR's
// ~60s TTL). When the instance is already paired (state=open), shows a success
// banner with the connected number instead of a QR.
//
// SECURITY NOTE: this page is intentionally unauthenticated for the initial
// pairing — there's no founder JWT yet to gate it against. Mitigations:
//   - X-Robots-Tag noindex,nofollow (no search engines)
//   - URL is unguessable but not secret; treat as obscure not private
//   - Once paired (state=open), no QR is shown; can't hijack a closed session
//   - DELETE THIS PAGE after pairing is confirmed, or lock it down with auth
//
// Implementation: server component, fetches Evolution API server-side using the
// EVOLUTION_API_KEY from agent env. Browser never sees the API key.

export const dynamic = 'force-dynamic';
export const revalidate = 0;

export const metadata = {
  title: 'WhatsApp pairing — Operscale Calendar',
  robots: 'noindex, nofollow',
};

interface EvolutionConnectionState {
  instance?: { instanceName?: string; state?: string; owner?: string };
}

interface EvolutionQRResponse {
  pairingCode?: string | null;
  code?: string;
  base64?: string;
  count?: number;
}

async function fetchState(): Promise<EvolutionConnectionState> {
  const base = process.env.EVOLUTION_API_BASE;
  const key = process.env.EVOLUTION_API_KEY;
  const inst = process.env.EVOLUTION_INSTANCE_NAME;
  if (!base || !key || !inst) {
    throw new Error('EVOLUTION_API_BASE / EVOLUTION_API_KEY / EVOLUTION_INSTANCE_NAME not set');
  }
  const r = await fetch(`${base}/instance/connectionState/${inst}`, {
    headers: { apikey: key },
    cache: 'no-store',
  });
  if (!r.ok) throw new Error(`Evolution connectionState HTTP ${r.status}`);
  return r.json();
}

async function fetchQR(): Promise<EvolutionQRResponse> {
  const base = process.env.EVOLUTION_API_BASE;
  const key = process.env.EVOLUTION_API_KEY;
  const inst = process.env.EVOLUTION_INSTANCE_NAME;
  const r = await fetch(`${base}/instance/connect/${inst}`, {
    headers: { apikey: key },
    cache: 'no-store',
  });
  if (!r.ok) throw new Error(`Evolution connect HTTP ${r.status}`);
  return r.json();
}

export default async function WhatsAppQRPage() {
  const fontStack = 'system-ui,-apple-system,Segoe UI,Roboto,Helvetica,Arial,sans-serif';
  const monoStack = 'ui-monospace,SFMono-Regular,Menlo,monospace';

  let state: EvolutionConnectionState | null = null;
  let qr: EvolutionQRResponse | null = null;
  let error: string | null = null;

  try {
    state = await fetchState();
    const stateName = state?.instance?.state;
    if (stateName !== 'open') {
      qr = await fetchQR();
    }
  } catch (e) {
    error = (e as Error).message;
  }

  const stateName = state?.instance?.state ?? 'unknown';
  const owner = state?.instance?.owner;
  const isPaired = stateName === 'open';

  return (
    <main
      style={{
        fontFamily: fontStack,
        maxWidth: 560,
        margin: '0 auto',
        padding: '2rem 1.5rem',
        color: '#111',
        textAlign: 'center',
      }}
    >
      {/* Auto-refresh every 25 seconds so the QR stays fresh (~60s TTL) */}
      {!isPaired ? <meta httpEquiv="refresh" content="25" /> : null}

      <h1 style={{ marginTop: 0, fontSize: '1.4rem' }}>
        Pair WhatsApp — <span style={{ fontFamily: monoStack, fontSize: '0.9em' }}>operscale-calendar</span>
      </h1>

      {error ? (
        <div
          style={{
            background: '#fee',
            border: '1px solid #f99',
            borderRadius: 6,
            padding: '12px',
            marginTop: '1rem',
            textAlign: 'left',
            fontFamily: monoStack,
            fontSize: 13,
            color: '#900',
          }}
        >
          Error fetching from Evolution: {error}
        </div>
      ) : isPaired ? (
        <div
          style={{
            background: '#efe',
            border: '1px solid #6c6',
            borderRadius: 8,
            padding: '20px',
            marginTop: '1.5rem',
          }}
        >
          <div style={{ fontSize: 32 }}>✓</div>
          <h2 style={{ margin: '0.5rem 0 0.25rem', fontSize: '1.1rem' }}>Already paired</h2>
          <p style={{ color: '#444', margin: 0 }}>
            Connected as <code style={{ fontFamily: monoStack }}>{owner ?? '(unknown number)'}</code>
          </p>
          <p style={{ color: '#888', fontSize: 13, marginTop: '1rem' }}>
            No QR needed. The Evolution session is live; outbound messages and inbound
            webhooks are flowing.
          </p>
        </div>
      ) : qr?.base64 ? (
        <>
          <p style={{ color: '#555', marginTop: 0 }}>
            On your phone, open <strong>WhatsApp</strong> →
            <strong> Linked Devices</strong> → <strong>Link a Device</strong>, then scan this code.
          </p>
          <img
            src={qr.base64}
            alt="WhatsApp pairing QR code"
            style={{
              display: 'block',
              margin: '0 auto',
              border: '1px solid #ddd',
              borderRadius: 8,
              padding: 8,
              background: '#fff',
              width: 320,
              height: 320,
            }}
          />
          <p style={{ color: '#888', fontSize: 12, marginTop: '0.75rem' }}>
            QR refreshes automatically every 25 seconds (TTL ~60s).
            <br />
            Instance state: <code style={{ fontFamily: monoStack }}>{stateName}</code>
          </p>
        </>
      ) : (
        <div style={{ color: '#888', fontSize: 14, marginTop: '1rem' }}>
          State: <code style={{ fontFamily: monoStack }}>{stateName}</code>. Could not fetch QR.
          Refresh the page or run <code>POST /instance/restart</code> on the Evolution API.
        </div>
      )}

      <p style={{ color: '#aaa', fontSize: 11, marginTop: '2.5rem' }}>
        SECURITY: This page exposes a live pairing QR. Once paired, delete this route
        or move it behind founder auth. See <code style={{ fontFamily: monoStack }}>
          docs/specs/whatsapp-flow.md
        </code>.
      </p>
    </main>
  );
}
