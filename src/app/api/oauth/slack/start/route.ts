/**
 * Phase 6 / Plan 06-01 — Slack OAuth start endpoint (USER-OAUTH for MCP).
 *
 * Sets a CSRF state cookie, then redirects to Slack's USER-OAuth consent screen
 * with the same state in the query string. The callback at
 * /api/oauth/slack/callback verifies cookie === query and exchanges the code
 * for a USER access_token (xoxp-...).
 *
 * Why user-OAuth (not bot-OAuth):
 *   The Slack-hosted MCP server at https://mcp.slack.com/mcp authenticates via
 *   a USER-level OAuth token, not a bot token. Per the OAuth metadata at
 *   https://mcp.slack.com/.well-known/oauth-authorization-server :
 *     - authorization_endpoint = https://slack.com/oauth/v2_user/authorize
 *     - token_endpoint         = https://slack.com/api/oauth.v2.user.access
 *   Bot tokens (xoxb-...) issued via the standard /oauth/v2/authorize +
 *   oauth.v2.access flow get rejected by mcp.slack.com with 401 invalid_token.
 *   See `.planning/debug/coo-no-slack-calls.md` Root Cause #5.
 *
 * This endpoint must be reached via a same-origin request (the "Connect Slack"
 * button) so the cookie is correctly set on agent-os.vapai.studio.
 */
import { randomBytes } from "node:crypto";
import { cookies } from "next/headers";
import { NextResponse } from "next/server";

const STATE_COOKIE = "slack_oauth_state";
// User-OAuth authorize endpoint (NOT /oauth/v2/authorize — that's bot OAuth).
const SLACK_AUTHORIZE_URL = "https://slack.com/oauth/v2_user/authorize";

// User scopes required by mcp.slack.com (cross-checked against the
// oauth-protected-resource metadata at mcp.slack.com/.well-known/...).
// These let the MCP server: list channels we're a member of, read channel
// history, search messages, post messages as the user, and read user profiles.
const SLACK_USER_SCOPES = [
  "channels:read",
  "channels:history",
  "groups:read",
  "groups:history",
  "mpim:history",
  "im:history",
  "chat:write",
  "search:read.public",
  "search:read.private",
  "search:read.mpim",
  "search:read.im",
  "users:read",
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
  // The v2_user/authorize endpoint takes `scope=` directly (NOT `user_scope=`)
  // because the endpoint itself is the user-only flow. Scopes listed here are
  // user-scope names per the MCP server's oauth-protected-resource metadata.
  authorizeUrl.searchParams.set("scope", SLACK_USER_SCOPES);
  authorizeUrl.searchParams.set("redirect_uri", redirectUri);
  authorizeUrl.searchParams.set("state", state);
  authorizeUrl.searchParams.set("response_type", "code");

  return NextResponse.redirect(authorizeUrl.toString());
}
