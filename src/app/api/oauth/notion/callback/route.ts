/**
 * Phase 7 / Plan 07-04 — Notion OAuth callback (PKCE verification + token exchange).
 *
 * Flow:
 *   1. Notion redirects here with ?code= + ?state= after the user approves.
 *   2. Validate state cookie (CSRF) — mismatch → 400 state_mismatch.
 *   3. Validate verifier cookie presence (W3 fix) — missing → 400 missing_verifier.
 *      Token exchange MUST NOT be attempted when the verifier cookie is absent.
 *   4. Clear both OAuth cookies (single-use, defense-in-depth).
 *   5. Authenticate caller as admin (user-scoped JWT check).
 *   6. Exchange code + code_verifier for access_token via mcp.notion.com/token.
 *   7. Encrypt access_token (+ refresh_token if present) via AES-256-GCM.
 *   8. INSERT into agentos.tool_connections (integration='notion').
 *   9. Write audit_logs row (action='tool_connection_create').
 *  10. Redirect to /agentos/tools?connected=notion.
 *
 * W3 fix (anti-regression): validation order is STRICT:
 *   1. state cookie check
 *   2. verifier cookie presence check
 *   3. Only then: token exchange
 * This prevents a race where the verifier cookie expires/is absent but state
 * matches — without W3 the code exchange would fail with a cryptic Notion error
 * instead of our explicit 400 missing_verifier.
 *
 * Required env vars:
 *   - NOTION_CLIENT_ID / NOTION_CLIENT_SECRET (from register_notion_dcr.py)
 *   - NOTION_REDIRECT_URI
 *   - TOOL_TOKEN_ENCRYPTION_KEY (shared with Modal Secret)
 *   - NEXT_PUBLIC_SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY
 */
import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { createClient as createServerClient } from "@supabase/supabase-js";

import { encryptToken } from "@/lib/encryption";
import { exchangeNotionCode } from "@/lib/notion_oauth";
import { createClient } from "@/lib/supabase/server";

const STATE_COOKIE = "notion_oauth_state";
const VERIFIER_COOKIE = "notion_oauth_verifier";

export async function GET(request: Request): Promise<Response> {
  const url = new URL(request.url);
  const code = url.searchParams.get("code");
  const stateParam = url.searchParams.get("state");
  const error = url.searchParams.get("error");

  // Surface user-facing errors from Notion's denial flow.
  if (error) {
    return NextResponse.redirect(
      new URL(`/agentos/tools?error=${encodeURIComponent(error)}`, url.origin),
    );
  }

  if (!code) {
    return NextResponse.json({ error: "missing_code" }, { status: 400 });
  }

  const cookieStore = await cookies();

  // --- Validation step 1: CSRF state check ---
  const stateCookie = cookieStore.get(STATE_COOKIE);
  if (!stateCookie?.value || !stateParam || stateCookie.value !== stateParam) {
    return NextResponse.json(
      { error: "state_mismatch", message: "CSRF check failed: state cookie does not match" },
      { status: 400 },
    );
  }

  // --- Validation step 2 (W3 fix): verifier cookie presence check ---
  // MUST happen BEFORE token exchange. If the verifier is absent, the PKCE
  // exchange would fail at Notion's end with a cryptic error. We surface a
  // clear 400 instead and skip the exchange entirely.
  const verifierCookie = cookieStore.get(VERIFIER_COOKIE);
  if (!verifierCookie?.value) {
    // Clear state cookie (it matched but we can't proceed)
    cookieStore.delete(STATE_COOKIE);
    return NextResponse.json(
      {
        error: "missing_verifier",
        message:
          "PKCE code_verifier cookie absent. The OAuth start route must set " +
          "the notion_oauth_verifier cookie before redirecting to Notion.",
      },
      { status: 400 },
    );
  }

  // --- Both validations passed: clear cookies (single-use) ---
  const codeVerifier = verifierCookie.value;
  cookieStore.delete(STATE_COOKIE);
  cookieStore.delete(VERIFIER_COOKIE);

  // --- Step 3: authenticate caller as admin ---
  const userClient = await createClient();
  const { data: userData, error: userErr } = await userClient.auth.getUser();
  if (userErr || !userData?.user) {
    return NextResponse.json({ error: "not_authenticated" }, { status: 401 });
  }
  const { data: claimsData } = await userClient.auth.getClaims();
  const appRole = (claimsData?.claims as Record<string, unknown> | undefined)?.app_role;
  if (appRole !== "admin") {
    return NextResponse.json({ error: "forbidden", required: "admin" }, { status: 403 });
  }
  const userId = userData.user.id;

  // --- Step 4: exchange code + verifier for tokens ---
  const redirectUri = process.env.NOTION_REDIRECT_URI;
  if (!redirectUri) {
    return NextResponse.json(
      { error: "notion_oauth_not_configured", missing: { redirectUri: true } },
      { status: 500 },
    );
  }

  let tokenResp;
  try {
    tokenResp = await exchangeNotionCode(code, codeVerifier, redirectUri);
  } catch (err) {
    return NextResponse.json(
      { error: "notion_token_exchange_failed", detail: String(err) },
      { status: 502 },
    );
  }

  if (!tokenResp.access_token) {
    return NextResponse.json({ error: "notion_oauth_no_access_token" }, { status: 400 });
  }

  // --- Step 5: encrypt token(s) ---
  const accessTokenCiphertext = encryptToken(tokenResp.access_token);
  const refreshTokenCiphertext = tokenResp.refresh_token
    ? encryptToken(tokenResp.refresh_token)
    : undefined;

  // expires_at as epoch ms (if expires_in is present)
  const expiresAt =
    typeof tokenResp.expires_in === "number"
      ? Date.now() + tokenResp.expires_in * 1000
      : undefined;

  // --- Step 6: write tool_connections row ---
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

  // Mark any existing connected row as disconnected (single connected row invariant).
  await sb
    .schema("agentos")
    .from("tool_connections")
    .update({ status: "disconnected", disconnected_at: new Date().toISOString() })
    .eq("integration", "notion")
    .eq("status", "connected");

  const metadata: Record<string, unknown> = {
    access_token_ciphertext: accessTokenCiphertext,
    workspace_id: tokenResp.workspace_id ?? null,
    workspace_name: tokenResp.workspace_name ?? null,
    workspace_icon: tokenResp.workspace_icon ?? null,
    bot_id: tokenResp.bot_id ?? null,
    scope: tokenResp.scope ?? null,
  };
  if (refreshTokenCiphertext) {
    metadata.refresh_token_ciphertext = refreshTokenCiphertext;
  }
  if (expiresAt !== undefined) {
    metadata.expires_at = expiresAt;
  }

  const { data: connectionRow, error: insertErr } = await sb
    .schema("agentos")
    .from("tool_connections")
    .insert({
      integration: "notion",
      connection_method: "anthropic_hosted",
      external_ref: tokenResp.workspace_id ?? null,
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

  // --- Step 7: audit log ---
  await sb
    .schema("agentos")
    .from("audit_logs")
    .insert({
      user_id: userId,
      action: "tool_connection_create",
      target_id: connectionRow.id,
      before: null,
      after: {
        integration: "notion",
        workspace_id: tokenResp.workspace_id ?? null,
        workspace_name: tokenResp.workspace_name ?? null,
      },
    });

  // --- Step 8: redirect to tools page ---
  return NextResponse.redirect(new URL("/agentos/tools?connected=notion", url.origin));
}
