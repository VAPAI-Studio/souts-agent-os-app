/**
 * Phase 6 / Plan 06-01 — Slack OAuth start endpoint.
 *
 * Sets a CSRF state cookie, then redirects to Slack's OAuth consent screen
 * with the same state in the query string. The callback at
 * /api/oauth/slack/callback verifies cookie === query.
 *
 * This endpoint must be reached via a same-origin request (the "Connect Slack"
 * button) so the cookie is correctly set on agent-os.vapai.studio.
 */
import { randomBytes } from "node:crypto";
import { cookies } from "next/headers";
import { NextResponse } from "next/server";

const STATE_COOKIE = "slack_oauth_state";
const SLACK_AUTHORIZE_URL = "https://slack.com/oauth/v2/authorize";

const SLACK_BOT_SCOPES = [
  "channels:read",
  "channels:history",
  "groups:history",
  "users:read",
  "chat:write",
  "chat:write.public",
  "search:read.public",
  "search:read.private",
].join(",");

export async function GET(request: Request): Promise<Response> {
  const clientId = process.env.SLACK_CLIENT_ID;
  const redirectUri = process.env.SLACK_REDIRECT_URI;

  if (!clientId || !redirectUri) {
    return NextResponse.json(
      {
        error: "slack_oauth_not_configured",
        missing: { clientId: !clientId, redirectUri: !redirectUri },
      },
      { status: 500 },
    );
  }

  const state = randomBytes(24).toString("hex");

  const cookieStore = await cookies();
  cookieStore.set(STATE_COOKIE, state, {
    httpOnly: true,
    secure: true,
    sameSite: "lax",
    path: "/",
    maxAge: 600,
  });

  const authorizeUrl = new URL(SLACK_AUTHORIZE_URL);
  authorizeUrl.searchParams.set("client_id", clientId);
  authorizeUrl.searchParams.set("scope", SLACK_BOT_SCOPES);
  authorizeUrl.searchParams.set("redirect_uri", redirectUri);
  authorizeUrl.searchParams.set("state", state);

  return NextResponse.redirect(authorizeUrl.toString());
}
