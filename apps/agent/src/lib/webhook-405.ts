// apps/agent/src/lib/webhook-405.ts
//
// Helper for webhook routes (POST-only by design). When someone browses to the
// URL with a GET, Next.js returns a bare 405 with no body and Chrome shows a
// generic "problem with this site" page. We replace that with an explanatory
// JSON body + the proper Allow: POST header per RFC 7231.

import { NextResponse } from 'next/server';

export function webhookGetExplainer(opts: { caller: string; spec: string }) {
  return NextResponse.json(
    {
      error: 'method_not_allowed',
      accepts: ['POST'],
      note: `This URL is a webhook endpoint, called server-to-server by ${opts.caller}. Browsers send GET on URL navigation, which is not supported here — that 405 response is correct REST behaviour, not a service error. The webhook itself works via POST.`,
      spec: opts.spec,
    },
    {
      status: 405,
      headers: { Allow: 'POST' },
    },
  );
}
