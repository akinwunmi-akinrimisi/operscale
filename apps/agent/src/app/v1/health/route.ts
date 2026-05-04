// GET /v1/health — liveness probe used by deploy.sh smoke test and
// UptimeRobot. Returns 200 OK with build metadata. This is the ONLY route
// in the agent that's intentionally implemented at scaffold time; everything
// else under /v1/* is a 501 stub awaiting real implementation.

import { NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

export function GET() {
  return NextResponse.json(
    {
      status: 'ok',
      service: 'operscale-calendar-agent',
      ts: new Date().toISOString(),
    },
    { status: 200 },
  );
}
