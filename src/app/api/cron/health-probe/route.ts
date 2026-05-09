/**
 * Phase 9 / Plan 09-01: Vercel Cron backstop handler for health probe.
 *
 * Schedule: every 5 minutes (see vercel.json)
 *
 * Vercel Cron sends GET with Authorization: Bearer ${CRON_SECRET}.
 * This handler validates the bearer and proxies POST to the Railway orchestrator's
 * /cron/health-probe endpoint.
 *
 * The orchestrator does the heavy lifting (design B):
 *   - Calls run_all_probes() → parallel 8-service health snapshot
 *   - For each result: calls record_health_transition per service (design B owner)
 *   - Collects transitions (changed=True entries)
 *   - Plan 09-05 wires Slack alert dispatch for transitions
 *
 * The "backstop" purpose: ensures probes run even when no admin is browsing
 * /agentos/health, closing the "outage during off-hours" gap. Page-load probing
 * alone would miss outages if no one visits the health page.
 */
import { NextRequest, NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

const ORCHESTRATOR_URL =
  process.env.ORCHESTRATOR_URL ||
  process.env.NEXT_PUBLIC_ORCHESTRATOR_URL ||
  'https://elegant-benevolence-production.up.railway.app';

export async function GET(req: NextRequest) {
  // 1. Validate the Vercel-attached bearer.
  const cronSecret = process.env.CRON_SECRET;
  if (!cronSecret) {
    return NextResponse.json(
      { error: 'CRON_SECRET not configured' },
      { status: 500 },
    );
  }
  const auth = req.headers.get('authorization');
  if (!auth || auth !== `Bearer ${cronSecret}`) {
    return NextResponse.json(
      { error: 'unauthorized' },
      { status: 401 },
    );
  }

  // 2. Forward to Railway orchestrator.
  const targetUrl = `${ORCHESTRATOR_URL}/cron/health-probe`;
  let upstream: Response;
  try {
    upstream = await fetch(targetUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${cronSecret}`,
      },
      body: JSON.stringify({
        fired_at: new Date().toISOString(),
        cron_path: '/api/cron/health-probe',
      }),
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    return NextResponse.json(
      { error: 'Failed to reach orchestrator', detail: msg },
      { status: 502 },
    );
  }

  const body = await upstream.text();
  return new NextResponse(body, {
    status: upstream.status,
    headers: { 'Content-Type': 'application/json' },
  });
}

// Allow POST so admins can fire the cron manually for smoke tests.
export const POST = GET;
