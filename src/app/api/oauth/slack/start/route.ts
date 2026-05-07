/**
 * Phase 6 / Plan 06-01 — Slack OAuth start endpoint (USER-OAUTH for MCP).
 * Phase 6.1 / Plan 06.1-04 — extended with BOT-OAUTH branch (?token_type=bot)
 *   for the runner's REST chat.postMessage path.
 *
 * Sets a CSRF state cookie + a token-type cookie, then redirects to Slack's
 * consent screen. The callback at /api/oauth/slack/callback verifies state
 * and reads the token-type cookie to decide:
 *   - which token endpoint to hit (oauth.v2.user.access vs oauth.v2.access)
 *   - which expectedPrefix to validate (xoxp- vs xoxb-)
 *   - which metadata fields to persist (slack_user_id vs bot_user_id+app_id)
 *
 * USER (?token_type=user OR no query — default):
 *   The Slack-hosted MCP server at https://mcp.slack.com/mcp authenticates
 *   via a USER-level OAuth token, not a bot token. Per the OAuth metadata
 *   at https://mcp.slack.com/.well-known/oauth-authorization-server :
 *     - authorization_endpoint = https://slack.com/oauth/v2_user/authorize
 *     - token_endpoint         = https://slack.com/api/oauth.v2.user.access
 *   Bot tokens (xoxb-) issued via the standard /oauth/v2/authorize +
 *   oauth.v2.access flow get rejected by mcp.slack.com with 401 invalid_token.
 *   See `.planning/debug/coo-no-slack-calls.md` Root Cause #5.
 *
 * BOT (?token_type=bot — Phase 6.1):
 *   Bot install via standard /oauth/v2/authorize + oauth.v2.access. Returns a
 *   xoxb- token used by runner.py's custom slack_bot SDK MCP server to call
 *   Slack REST chat.postMessage with bot identity (closes Phase 6 Gap 1: COO
 *   posts must appear as the bot, not the admin user). Reads continue to use
 *   the user token via mcp.slack.com.
 *
 * B1 invariant (anti-regression): redirect_uri is the SAME value
 * (process.env.SLACK_REDIRECT_URI) for BOTH flows. Slack permits a single
 * redirect_uri to handle both flows because the callback distinguishes by
 * the slack_oauth_token_type cookie + the chosen token endpoint, NOT by URL.
 * Do NOT introduce a second hardcoded URL.
 *
 * This endpoint must be reached via a same-origin request (the "Connect Slack"
 * button or a direct browser visit to /api/oauth/slack/start?token_type=bot)
 * so the cookies are correctly set on agent-os.vapai.studio.
 */
import { randomBytes } from "node:crypto";
import { cookies } from "next/headers";
import { NextResponse } from "next/server";

const STATE_COOKIE = "slack_oauth_state";
// Phase 6.1 / Plan 06.1-04: cookie set during start, read by callback to
// branch token endpoint + expected token prefix + persisted metadata shape.
const TOKEN_TYPE_COOKIE = "slack_oauth_token_type";

// User-OAuth authorize endpoint (used when token_type=user OR unset).
// NOT /oauth/v2/authorize — that's bot OAuth.
const SLACK_USER_AUTHORIZE_URL = "https://slack.com/oauth/v2_user/authorize";

// Bot-OAuth authorize endpoint (Phase 6.1 / Plan 06.1-04).
const SLACK_BOT_AUTHORIZE_URL = "https://slack.com/oauth/v2/authorize";

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

// Bot Token Scopes (Phase 6.1 / Plan 06.1-04). Already added to the Slack App
// config during Phase 6 walkthrough. These are the scopes the bot identity
// needs to post via REST chat.postMessage and read auth.test for bot_user_id.
const SLACK_BOT_SCOPES = [
  "channels:read",
  "channels:history",
  "chat:write",
  "chat:write.public",
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

  // Phase 6.1 / Plan 06.1-04: branch on ?token_type=bot|user (default user).
  const url = new URL(request.url);
  const tokenTypeParam = url.searchParams.get("token_type");
  const tokenType: "user" | "bot" = tokenTypeParam === "bot" ? "bot" : "user";

  const state = randomBytes(24).toString("hex");

  const cookieStore = await cookies();
  cookieStore.set(STATE_COOKIE, state, {
    httpOnly: true,
    secure: true,
    sameSite: "lax",
    path: "/",
    maxAge: 600,
  });
  // Token-type cookie: same TTL/flags as state cookie. Cleared by callback.
  cookieStore.set(TOKEN_TYPE_COOKIE, tokenType, {
    httpOnly: true,
    secure: true,
    sameSite: "lax",
    path: "/",
    maxAge: 600,
  });

  const authorizeUrl = new URL(
    tokenType === "bot" ? SLACK_BOT_AUTHORIZE_URL : SLACK_USER_AUTHORIZE_URL,
  );
  authorizeUrl.searchParams.set("client_id", clientId);
  // The v2_user/authorize endpoint takes `scope=` directly (NOT `user_scope=`)
  // because the endpoint itself is the user-only flow. The bot /oauth/v2/authorize
  // endpoint takes `scope=` for bot scopes. Same query-param name in both flows.
  authorizeUrl.searchParams.set(
    "scope",
    tokenType === "bot" ? SLACK_BOT_SCOPES : SLACK_USER_SCOPES,
  );
  // B1 invariant: SAME redirect_uri value for both flows (the single
  // process.env.SLACK_REDIRECT_URI). Branching at callback time is via the
  // TOKEN_TYPE_COOKIE + the chosen token endpoint — NOT by URL.
  authorizeUrl.searchParams.set("redirect_uri", redirectUri);
  authorizeUrl.searchParams.set("state", state);
  authorizeUrl.searchParams.set("response_type", "code");

  return NextResponse.redirect(authorizeUrl.toString());
}
