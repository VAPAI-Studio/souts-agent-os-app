/**
 * Phase 9 / Plan 09-01: Vercel Cron handler for monthly budget reset.
 *
 * Schedule: 0 0 1 * * (00:00 UTC on the 1st of every month)
 *
 * Vercel Cron sends GET with Authorization: Bearer ${CRON_SECRET}.
 * This handler validates the bearer and proxies POST to the Railway orchestrator's
 * /cron/monthly-reset endpoint.
 *
 * The orchestrator does the heavy lifting:
 *   - Zeroes monthly_spent_usd for ALL agents
 *   - Resumes ONLY agents auto-paused by budget cap (via DISTINCT ON audit_logs check)
 *   - Agents manually paused for other reasons stay paused
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
  const targetUrl = `${ORCHESTRATOR_URL}/cron/monthly-reset`;
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
        cron_path: '/api/cron/monthly-reset',
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
