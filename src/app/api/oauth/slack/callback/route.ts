/**
 * Phase 6 / Plan 06-01: Slack OAuth callback Route Handler.
 *
 * Flow (CONTEXT §4 + RESEARCH §1d):
 *   1. Slack redirects here with ?code= and ?state= after the user approves the bot install.
 *   2. Verify state cookie (CSRF protection — set during the redirect-to-Slack step).
 *   3. Exchange the code for an access_token via slack.com/api/oauth.v2.access.
 *   4. Encrypt the access_token using the encryption helper (AES-256-GCM).
 *   5. Verify the calling user is admin (RLS enforces too, but Server-Action gate is defense in depth).
 *   6. UPSERT into agentos.tool_connections via service-role client.
 *   7. Write audit_logs row (action='tool_connection_create' — enum value added in the
 *      tool_connections migration).
 *   8. Redirect to /agentos/tools?connected=slack.
 *
 * SECURITY: Uses service-role client for the DB write. The user-scoped client is used
 * only to authenticate the caller (admin check). Token is NEVER returned to the browser.
 */
import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { createClient as createServerClient } from "@supabase/supabase-js";

import { encryptToken } from "@/lib/encryption";
import { createClient } from "@/lib/supabase/server";

interface SlackOAuthV2Response {
  ok: boolean;
  error?: string;
  access_token?: string;
  bot_user_id?: string;
  app_id?: string;
  team?: { id: string; name: string };
  authed_user?: { id: string };
  scope?: string;
  token_type?: string;
}

const SLACK_OAUTH_TOKEN_URL = "https://slack.com/api/oauth.v2.access";
const STATE_COOKIE = "slack_oauth_state";

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

  let tokenResp: SlackOAuthV2Response;
  try {
    const formBody = new URLSearchParams({
      client_id: clientId,
      client_secret: clientSecret,
      code,
      redirect_uri: redirectUri,
    });
    const res = await fetch(SLACK_OAUTH_TOKEN_URL, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: formBody.toString(),
    });
    tokenResp = (await res.json()) as SlackOAuthV2Response;
  } catch (err) {
    return NextResponse.json(
      { error: "slack_token_exchange_failed", detail: String(err) },
      { status: 502 },
    );
  }

  if (!tokenResp.ok || !tokenResp.access_token) {
    return NextResponse.json(
      { error: "slack_oauth_error", slack_error: tokenResp.error },
      { status: 400 },
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
  const botUserId = tokenResp.bot_user_id ?? "";

  // Mark any existing 'connected' row for this integration as 'disconnected' to honor
  // the partial unique index. This preserves history (multiple disconnected rows allowed).
  await sb
    .schema("agentos")
    .from("tool_connections")
    .update({ status: "disconnected", disconnected_at: new Date().toISOString() })
    .eq("integration", "slack")
    .eq("status", "connected");

  // Insert fresh connected row.
  const { data: connectionRow, error: insertErr } = await sb
    .schema("agentos")
    .from("tool_connections")
    .insert({
      integration: "slack",
      connection_method: "anthropic_hosted",
      external_ref: teamId,
      status: "connected",
      connected_by: userId,
      metadata: {
        workspace: teamName,
        team_id: teamId,
        bot_user_id: botUserId,
        access_token_ciphertext: accessTokenCiphertext,
        scope: tokenResp.scope ?? null,
      },
    })
    .select("id")
    .single();

  if (insertErr || !connectionRow) {
    return NextResponse.json(
      { error: "tool_connection_insert_failed", detail: insertErr?.message },
      { status: 500 },
    );
  }

  // 6. Audit log row — column is `action` (an enum-typed column). Per STATE.md drift note:
  //    never write `actionType` to this row; the column name is exactly `action`.
  await sb
    .schema("agentos")
    .from("audit_logs")
    .insert({
      user_id: userId,
      action: "tool_connection_create",
      target_id: connectionRow.id,
      before: null,
      after: { integration: "slack", team_id: teamId, workspace: teamName },
    });

  // 7. Redirect to tools page with success flag.
  return NextResponse.redirect(
    new URL(`/agentos/tools?connected=slack`, url.origin),
  );
}
