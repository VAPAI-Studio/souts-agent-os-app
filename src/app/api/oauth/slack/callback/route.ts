/**
 * Phase 6 / Plan 06-01: Slack OAuth callback Route Handler (USER-OAUTH for MCP).
 * Phase 6.1 / Plan 06.1-04: extended with BOT-OAUTH branch (token_type=bot
 *   read from slack_oauth_token_type cookie set by start/route.ts).
 *
 * Flow (CONTEXT §4 + RESEARCH §1d):
 *   1. Slack redirects here with ?code= and ?state= after the user approves.
 *   2. Verify state cookie (CSRF protection — set during the redirect-to-Slack step).
 *   3. Read TOKEN_TYPE_COOKIE — "bot" branch hits oauth.v2.access (xoxb-),
 *      otherwise "user" branch hits oauth.v2.user.access (xoxp-).
 *   4. Encrypt the access_token using the encryption helper (AES-256-GCM).
 *   5. Verify the calling user is admin (RLS enforces too, but Server-Action gate is defense in depth).
 *   6. Mark previous 'connected' row of THE SAME token_type as 'disconnected'
 *      (so user+bot rows can coexist; only same-type churn replaces).
 *   7. INSERT into agentos.tool_connections with metadata.token_type =
 *      tokenTypeCookie. For bot flow, also persist bot_user_id + app_id; for
 *      user flow, persist slack_user_id (legacy).
 *   8. Write audit_logs row (action='tool_connection_create').
 *   9. Redirect to /agentos/tools?connected=slack&token_type=<flow>.
 *
 * Why two flows (user + bot):
 *   - User flow → MCP read tools at mcp.slack.com (xoxp- required).
 *   - Bot flow → REST chat.postMessage with bot identity (Phase 6 Gap 1 fix).
 *   See start/route.ts header for the long-form rationale.
 *
 * B1 invariant (anti-regression): the callback path is /api/oauth/slack/callback
 * for BOTH flows. process.env.SLACK_REDIRECT_URI is the single source of the
 * redirect_uri value passed back to Slack's token-exchange endpoint. The
 * callback distinguishes flows ONLY by the TOKEN_TYPE_COOKIE and the chosen
 * token endpoint URL — NOT by a second redirect_uri value.
 *
 * SECURITY: Uses service-role client for the DB write. The user-scoped client
 * is used only to authenticate the caller (admin check). Token is NEVER
 * returned to the browser.
 */
import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { createClient as createServerClient } from "@supabase/supabase-js";

import { encryptToken } from "@/lib/encryption";
import { createClient } from "@/lib/supabase/server";

// User-OAuth response shape per https://docs.slack.dev/reference/methods/oauth.v2.user.access/
// The user access_token (xoxp-...) is returned at TOP LEVEL (token_type='user').
// Note: this differs from oauth.v2.access (bot flow) where the top-level
// access_token IS the bot token (xoxb-).
interface SlackOAuthV2UserResponse {
  ok: boolean;
  error?: string;
  access_token?: string;       // xoxp-... user token
  token_type?: string;         // "user"
  scope?: string;              // granted user scopes (comma-separated)
  authed_user?: {
    id: string;                // user ID who authorized
    scope?: string;
  };
  team?: { id: string; name?: string };
  enterprise?: { id: string; name?: string } | null;
  app_id?: string;
}

// Bot-OAuth response shape per https://docs.slack.dev/reference/methods/oauth.v2.access/
// In the bot flow the TOP-LEVEL access_token is the BOT token (xoxb-);
// authed_user is the installer (we do NOT use the installer's user token here).
interface SlackOAuthV2BotResponse {
  ok: boolean;
  error?: string;
  access_token?: string;       // xoxb-... bot token
  token_type?: string;         // "bot"
  scope?: string;              // granted bot scopes
  bot_user_id?: string;        // The bot user's Slack ID (e.g., U01XXXXXXXX)
  app_id?: string;             // The Slack App ID
  team?: { id: string; name?: string };
  authed_user?: { id: string };
  enterprise?: { id: string; name?: string } | null;
}

// Token endpoints — branched in GET() by TOKEN_TYPE_COOKIE.
const SLACK_OAUTH_USER_TOKEN_URL = "https://slack.com/api/oauth.v2.user.access";
const SLACK_OAUTH_BOT_TOKEN_URL = "https://slack.com/api/oauth.v2.access";
const STATE_COOKIE = "slack_oauth_state";
const TOKEN_TYPE_COOKIE = "slack_oauth_token_type";

export async function GET(request: Request): Promise<Response> {
  const url = new URL(request.url);
  const code = url.searchParams.get("code");
  const state = url.searchParams.get("state");
  const error = url.searchParams.get("error");

  // Surface user-facing errors from Slack's denial flow.
  if (error) {
    return NextResponse.redirect(
      new URL(`/agentos/tools?error=${encodeURIComponent(error)}`, url.origin),
    );
  }

  if (!code) {
    return NextResponse.json({ error: "missing_code" }, { status: 400 });
  }

  // 1. CSRF state cookie verification.
  const cookieStore = await cookies();
  const stateCookie = cookieStore.get(STATE_COOKIE);
  if (!stateCookie?.value || !state || stateCookie.value !== state) {
    return NextResponse.json(
      { error: "state_mismatch", message: "CSRF check failed: state cookie does not match" },
      { status: 400 },
    );
  }
  // Clear the state cookie after use (single-use, defense-in-depth).
  cookieStore.delete(STATE_COOKIE);

  // Phase 6.1 / Plan 06.1-04: read token-type cookie set by start/route.ts.
  // Default to "user" if missing (backwards-compat with pre-Phase-6.1 clients
  // hitting an in-flight callback after the deploy).
  const tokenTypeRaw = cookieStore.get(TOKEN_TYPE_COOKIE)?.value;
  const tokenTypeCookie: "user" | "bot" = tokenTypeRaw === "bot" ? "bot" : "user";
  cookieStore.delete(TOKEN_TYPE_COOKIE);

  // 2. Authenticate the caller as admin BEFORE doing any external work.
  const userClient = await createClient();
  const { data: userData, error: userErr } = await userClient.auth.getUser();
  if (userErr || !userData?.user) {
    return NextResponse.json({ error: "not_authenticated" }, { status: 401 });
  }
  // Admin check via JWT claims (matches Plan 04-05 Server-Action pattern).
  const { data: claimsData } = await userClient.auth.getClaims();
  const appRole = (claimsData?.claims as Record<string, unknown> | undefined)?.app_role;
  if (appRole !== "admin") {
    return NextResponse.json({ error: "forbidden", required: "admin" }, { status: 403 });
  }
  const userId = userData.user.id;

  // 3. Exchange code for access_token.
  const clientId = process.env.SLACK_CLIENT_ID;
  const clientSecret = process.env.SLACK_CLIENT_SECRET;
  const redirectUri = process.env.SLACK_REDIRECT_URI;
  if (!clientId || !clientSecret || !redirectUri) {
    return NextResponse.json(
      { error: "slack_oauth_not_configured", missing: { clientId: !clientId, clientSecret: !clientSecret, redirectUri: !redirectUri } },
      { status: 500 },
    );
  }

  // Phase 6.1 / Plan 06.1-04: branch the token endpoint by token-type cookie.
  // B1 invariant: the redirect_uri value below is the SAME for both flows.
  const tokenUrl =
    tokenTypeCookie === "bot" ? SLACK_OAUTH_BOT_TOKEN_URL : SLACK_OAUTH_USER_TOKEN_URL;

  let tokenResp: SlackOAuthV2UserResponse | SlackOAuthV2BotResponse;
  try {
    const formBody = new URLSearchParams({
      client_id: clientId,
      client_secret: clientSecret,
      code,
      redirect_uri: redirectUri,
    });
    const res = await fetch(tokenUrl, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: formBody.toString(),
    });
    tokenResp = (await res.json()) as SlackOAuthV2UserResponse | SlackOAuthV2BotResponse;
  } catch (err) {
    return NextResponse.json(
      { error: "slack_token_exchange_failed", detail: String(err) },
      { status: 502 },
    );
  }

  if (!tokenResp.ok || !tokenResp.access_token) {
    return NextResponse.json(
      { error: "slack_oauth_error", slack_error: tokenResp.error, token_type: tokenTypeCookie },
      { status: 400 },
    );
  }

  // Sanity check: bot flow must yield xoxb-, user flow must yield xoxp-.
  // Don't hard-fail (Slack may evolve token formats), but log a warning if
  // the prefix is unexpected — operators can grep for this.
  const expectedPrefix = tokenTypeCookie === "bot" ? "xoxb-" : "xoxp-";
  if (!tokenResp.access_token.startsWith(expectedPrefix)) {
    console.warn(
      "[slack-oauth-callback] expected %s, got %s... (token_type=%s)",
      expectedPrefix,
      tokenResp.access_token.slice(0, 5),
      tokenTypeCookie,
    );
  }

  // 4. Encrypt the access token.
  const accessTokenCiphertext = encryptToken(tokenResp.access_token);

  // 5. UPSERT tool_connections row via service-role client (RLS bypass — admin already verified).
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!supabaseUrl || !serviceRoleKey) {
    return NextResponse.json(
      { error: "supabase_service_role_not_configured" },
      { status: 500 },
    );
  }
  const sb = createServerClient(supabaseUrl, serviceRoleKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  const teamId = tokenResp.team?.id ?? "";
  const teamName = tokenResp.team?.name ?? "";

  // Mark previous 'connected' row of THE SAME token_type as 'disconnected'.
  // Phase 6.1 / Plan 06.1-04: scope by metadata.token_type so user+bot rows
  // can coexist. The dual partial unique index migration enforces uniqueness
  // per (integration='slack', token_type) — this UPDATE just protects against
  // accidental dupes during a re-install of the same flow.
  await sb
    .schema("agentos")
    .from("tool_connections")
    .update({ status: "disconnected", disconnected_at: new Date().toISOString() })
    .eq("integration", "slack")
    .eq("status", "connected")
    .eq("metadata->>token_type", tokenTypeCookie);

  // Build metadata payload — branched on flow.
  const isBot = tokenTypeCookie === "bot";
  const metadata: Record<string, unknown> = {
    workspace: teamName,
    team_id: teamId,
    access_token_ciphertext: accessTokenCiphertext,
    scope: tokenResp.scope ?? null,
    token_type: tokenTypeCookie,
  };
  if (isBot) {
    const bot = tokenResp as SlackOAuthV2BotResponse;
    metadata.bot_user_id = bot.bot_user_id ?? null;
    metadata.app_id = bot.app_id ?? null;
  } else {
    const user = tokenResp as SlackOAuthV2UserResponse;
    metadata.slack_user_id = user.authed_user?.id ?? "";
  }

  const { data: connectionRow, error: insertErr } = await sb
    .schema("agentos")
    .from("tool_connections")
    .insert({
      integration: "slack",
      connection_method: "anthropic_hosted",
      external_ref: teamId,
      status: "connected",
      connected_by: userId,
      metadata,
    })
    .select("id")
    .single();

  if (insertErr || !connectionRow) {
    return NextResponse.json(
      { error: "tool_connection_insert_failed", detail: insertErr?.message },
      { status: 500 },
    );
  }

  // 6. Audit log row — column is `action` (an enum-typed column). Per STATE.md
  //    drift note: never write `actionType` to this row; the column name is
  //    exactly `action`.
  await sb
    .schema("agentos")
    .from("audit_logs")
    .insert({
      user_id: userId,
      action: "tool_connection_create",
      target_id: connectionRow.id,
      before: null,
      after: {
        integration: "slack",
        team_id: teamId,
        workspace: teamName,
        token_type: tokenTypeCookie,
      },
    });

  // 7. Redirect to tools page with success + flow flag.
  return NextResponse.redirect(
    new URL(
      `/agentos/tools?connected=slack&token_type=${tokenTypeCookie}`,
      url.origin,
    ),
  );
}
