/**
 * Plan 02-03: Vercel Cron handler.
 *
 * Triggered by Vercel Cron per vercel.json schedule "0 * * * *" (every hour at :00).
 * Authenticates the incoming request via Vercel's CRON_SECRET (Authorization: Bearer ...),
 * then proxies a POST /runs/scheduled-trigger to the Railway orchestrator with the SAME
 * CRON_SECRET as the bearer.
 *
 * In production, Vercel automatically attaches `Authorization: Bearer ${CRON_SECRET}` if
 * the CRON_SECRET env var is set in the Vercel project. See:
 *   https://vercel.com/docs/cron-jobs/manage-cron-jobs#securing-cron-jobs
 */
import { NextRequest, NextResponse } from "next/server";

const ORCHESTRATOR_URL =
  process.env.ORCHESTRATOR_URL ||
  process.env.NEXT_PUBLIC_ORCHESTRATOR_URL ||
  "https://elegant-benevolence-production.up.railway.app";

export async function GET(request: NextRequest) {
  // 1. Validate the incoming request is from Vercel Cron
  const cronSecret = process.env.CRON_SECRET;
  if (!cronSecret) {
    return NextResponse.json(
      { error: "CRON_SECRET not configured" },
      { status: 500 },
    );
  }
  const auth = request.headers.get("authorization");
  if (!auth || auth !== `Bearer ${cronSecret}`) {
    return NextResponse.json(
      { error: "Unauthorized — invalid or missing bearer" },
      { status: 401 },
    );
  }

  // 2. Forward to Railway orchestrator with the same secret
  const triggerUrl = `${ORCHESTRATOR_URL}/runs/scheduled-trigger`;
  let upstreamRes: Response;
  try {
    upstreamRes = await fetch(triggerUrl, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${cronSecret}`,
      },
      body: JSON.stringify({
        trigger_type: "scheduled",
        payload: {
          cron_path: "/api/cron",
          cron_schedule: "0 * * * *",
          fired_at: new Date().toISOString(),
        },
      }),
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    return NextResponse.json(
      { error: "Failed to reach orchestrator", detail: msg },
      { status: 502 },
    );
  }

  const upstreamBody = await upstreamRes.text();
  return new NextResponse(upstreamBody, {
    status: upstreamRes.status,
    headers: { "Content-Type": "application/json" },
  });
}

// Optional: allow POST as a smoke-test path (curl from local machine).
// Vercel Cron uses GET; this POST handler exists so admins can manually fire the cron.
export async function POST(request: NextRequest) {
  return GET(request);
}
