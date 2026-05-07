// apps/agent/src/lib/cors.ts
//
// Cross-origin allowance for agent endpoints called from the CRM at
// https://operscale.cloud/admin/*. The CRM lives on a different origin to
// the agent (api.operscale.cloud), so any cross-origin POST with a custom
// header (Authorization, content-type) triggers a CORS preflight which
// requires explicit allow-origin headers on both the OPTIONS response AND
// every subsequent response.
//
// Allowed origins are intentionally a small literal set — no wildcards.
// A non-allowed origin gets the standard same-origin treatment (no
// Access-Control-* headers); the browser then blocks the call.
//
// Usage in a route handler:
//
//   export function OPTIONS(req: NextRequest): Response {
//     return corsPreflight(req);
//   }
//   export async function POST(req: NextRequest): Promise<Response> {
//     const origin = req.headers.get('origin');
//     // ...handler logic...
//     return jsonWithCors({ ok: true }, 200, origin);
//   }
//
// CLAUDE.md "no shortcuts" rule applies: the same allow-list is used for
// every route. Drift between routes would create surprising 401-from-CORS
// behaviour that's hard to diagnose.
//
// Implementation note: this module uses the vanilla web Response/Request
// runtime APIs rather than next/server. The worker's tsconfig
// (tsconfig.worker.json) does NOT include Next.js types, and the worker
// transitively pulls this file in through @/lib/supabase-admin → routes,
// so importing NextResponse here breaks the worker build.

const ALLOWED_ORIGINS = new Set<string>([
  'https://operscale.cloud',
  'https://www.operscale.cloud',
]);

const DEFAULT_ALLOWED_HEADERS = 'content-type, authorization';

export function corsHeaders(origin: string | null): Record<string, string> {
  if (!origin || !ALLOWED_ORIGINS.has(origin)) return {};
  return {
    'access-control-allow-origin': origin,
    'access-control-allow-methods': 'POST, OPTIONS',
    'access-control-allow-headers': DEFAULT_ALLOWED_HEADERS,
    'access-control-max-age': '600',
    vary: 'origin',
  };
}

export function corsPreflight(req: Request): Response {
  const origin = req.headers.get('origin');
  return new Response(null, { status: 204, headers: corsHeaders(origin) });
}

export function jsonWithCors(
  body: Record<string, unknown>,
  status: number,
  origin: string | null,
): Response {
  const headers = new Headers(corsHeaders(origin));
  headers.set('content-type', 'application/json');
  return new Response(JSON.stringify(body), { status, headers });
}

/**
 * Wraps a route handler so the response carries the right Access-Control-*
 * headers without having to thread `origin` through every return statement.
 * Use when the handler already exists and uses NextResponse.json everywhere
 * (eg. /v1/brief/approve, /v1/brief/discard) — minimum-diff alternative to
 * jsonWithCors.
 */
export function withCors<T extends Request>(
  handler: (req: T) => Promise<Response>,
): (req: T) => Promise<Response> {
  return async (req) => {
    const origin = req.headers.get('origin');
    const res = await handler(req);
    const merged = new Headers(res.headers);
    for (const [k, v] of Object.entries(corsHeaders(origin))) {
      merged.set(k, v);
    }
    return new Response(res.body, {
      status: res.status,
      statusText: res.statusText,
      headers: merged,
    });
  };
}
