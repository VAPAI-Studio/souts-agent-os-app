/**
 * Plan 06-03b: Vercel Cron handler for the generic per-agent scheduler.
 *
 * Schedule: every 5 minutes (vercel.json crons schedule).
 *
 * Vercel Cron sends an HTTP GET with `Authorization: Bearer ${CRON_SECRET}` (CRON_SECRET
 * env var must be set in the Vercel project). This route validates that bearer, then
 * proxies a POST to the Railway orchestrator's /runs/scheduled-trigger endpoint with the
 * SAME bearer.
 *
 * The orchestrator does the heavy lifting:
 *   - SELECT due agents with FOR UPDATE SKIP LOCKED
 *   - compute_next() per agent + UPDATE next_run_at
 *   - INSERT agent_runs + audit_logs + Arq enqueue per dispatched agent
 *
 * Replaces Plan 02-03's ACK-only /api/cron handler.
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
  const triggerUrl = `${ORCHESTRATOR_URL}/runs/scheduled-trigger`;
  let upstream: Response;
  try {
    upstream = await fetch(triggerUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${cronSecret}`,
      },
      body: JSON.stringify({
        trigger_type: 'scheduled',
        fired_at: new Date().toISOString(),
        cron_path: '/api/cron/scheduled-trigger',
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
