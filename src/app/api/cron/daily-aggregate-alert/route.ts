/**
 * Phase 9 / Plan 09-01: Vercel Cron handler for daily aggregate spend alert.
 *
 * Schedule: every 15 minutes (see vercel.json)
 *
 * Vercel Cron sends GET with Authorization: Bearer ${CRON_SECRET}.
 * This handler validates the bearer and proxies POST to the Railway orchestrator's
 * /cron/daily-aggregate-alert endpoint.
 *
 * The orchestrator does the heavy lifting:
 *   - Advisory lock to prevent concurrent double-fires
 *   - Checks if already alerted today (idempotent per UTC day)
 *   - Computes today's aggregate spend across all agents
 *   - If total >= threshold AND not yet alerted: fires alert + dedupes via org_settings
 *   - Plan 09-04 wires the actual Slack DM notification
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
  const targetUrl = `${ORCHESTRATOR_URL}/cron/daily-aggregate-alert`;
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
        cron_path: '/api/cron/daily-aggregate-alert',
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
