/**
 * Phase 6 / Plan 06-01b: Google Calendar OAuth callback Route Handler.
 *
 * Flow (mirrors Plan 06-01 Slack callback):
 *   1. Google redirects here with ?code= and ?state= after the user approves the
 *      Calendar scopes.
 *   2. Verify state cookie (CSRF protection — set during the redirect-to-Google step).
 *   3. Exchange the code for an access_token + refresh_token via
 *      oauth2.googleapis.com/token.
 *   4. Encrypt BOTH access_token and refresh_token via AES-256-GCM (encryption.ts).
 *   5. Verify the calling user is admin (RLS enforces too, but Server-Action gate is
 *      defense in depth).
 *   6. UPSERT into agentos.tool_connections via service-role client (integration =
 *      'google_calendar', status='connected', metadata holds both ciphertexts +
 *      expires_at + scopes).
 *   7. Write audit_logs row (column is `action`, NEVER actionType — Plan 04-05/06
 *      drift fix). action value: 'tool_connection_create'.
 *   8. Redirect to /agentos/tools?connected=google_calendar.
 *
 * Required OAuth scopes (Phase 6 read-only — RESEARCH §2a):
 *   - https://www.googleapis.com/auth/calendar.calendarlist.readonly
 *   - https://www.googleapis.com/auth/calendar.events.freebusy
 *   - https://www.googleapis.com/auth/calendar.events.readonly
 *
 * Required env vars:
 *   - GOOGLE_CLIENT_ID
 *   - GOOGLE_CLIENT_SECRET
 *   - GOOGLE_REDIRECT_URI
 *   - TOOL_TOKEN_ENCRYPTION_KEY (shared with Modal Secret)
 *   - NEXT_PUBLIC_SUPABASE_URL
 *   - SUPABASE_SERVICE_ROLE_KEY
 *
 * SECURITY: Tokens are NEVER returned to the browser. Service-role client used only
 * for the DB write — admin gate enforced first via the user-scoped JWT.
 */
import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { createClient as createServerClient } from "@supabase/supabase-js";

import { encryptToken } from "@/lib/encryption";
import { exchangeAuthCodeForToken } from "@/lib/google_oauth";
import { createClient } from "@/lib/supabase/server";

const STATE_COOKIE = "google_oauth_state";

// Phase 6 read-only Calendar scopes — write scopes (events.write, calendars) are
// deliberately deferred to Phase 7. If you change this list, update the comment in
// google_oauth.ts AND the Slack-style admin install URL the user pastes in the
// Plan 06-01b Task 4 checkpoint instructions.
const PHASE_6_CALENDAR_SCOPES = [
  "https://www.googleapis.com/auth/calendar.calendarlist.readonly",
  "https://www.googleapis.com/auth/calendar.events.freebusy",
  "https://www.googleapis.com/auth/calendar.events.readonly",
];

export async function GET(request: Request): Promise<Response> {
  const url = new URL(request.url);
  const code = url.searchParams.get("code");
  const state = url.searchParams.get("state");
  const error = url.searchParams.get("error");

  // Surface user-facing errors from Google's denial flow.
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
      {
        error: "state_mismatch",
        message: "CSRF check failed: state cookie does not match",
      },
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
  const { data: claimsData } = await userClient.auth.getClaims();
  const appRole = (claimsData?.claims as Record<string, unknown> | undefined)
    ?.app_role;
  if (appRole !== "admin") {
    return NextResponse.json(
      { error: "forbidden", required: "admin" },
      { status: 403 },
    );
  }
  const userId = userData.user.id;

  // 3. Exchange code for access_token + refresh_token.
  const redirectUri = process.env.GOOGLE_REDIRECT_URI;
  if (!redirectUri) {
    return NextResponse.json(
      {
        error: "google_oauth_not_configured",
        missing: { redirectUri: !redirectUri },
      },
      { status: 500 },
    );
  }

  let tokenResp;
  try {
    tokenResp = await exchangeAuthCodeForToken(code, redirectUri);
  } catch (err) {
    return NextResponse.json(
      { error: "google_token_exchange_failed", detail: String(err) },
      { status: 502 },
    );
  }

  if (!tokenResp.access_token) {
    return NextResponse.json(
      { error: "google_oauth_no_access_token" },
      { status: 400 },
    );
  }

  // Best-effort verification that the consent grant actually included offline access.
  // Without a refresh_token the runner cannot survive the 1-hour access_token expiry,
  // so we surface a clear error rather than silently saving a connection that will
  // break in an hour. The user's install URL must include access_type=offline&prompt=consent.
  if (!tokenResp.refresh_token) {
    return NextResponse.json(
      {
        error: "google_oauth_no_refresh_token",
        message:
          "Google did not return a refresh_token. The install URL must include " +
          "access_type=offline&prompt=consent. See Plan 06-01b Task 4 instructions.",
      },
      { status: 400 },
    );
  }

  // 4. Encrypt BOTH tokens (mirror-encryption pattern from Plan 06-01).
  const accessTokenCiphertext = encryptToken(tokenResp.access_token);
  const refreshTokenCiphertext = encryptToken(tokenResp.refresh_token);

  // expires_at = now + expires_in (seconds), recorded as epoch milliseconds so the
  // runner can compare against Date.now()-equivalent without timezone math.
  const expiresAt = Date.now() + tokenResp.expires_in * 1000;
  const grantedScopes = (tokenResp.scope || "")
    .split(/\s+/)
    .filter((s) => s.length > 0);

  // 5. UPSERT tool_connections via service-role client (RLS bypass — admin verified above).
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

  // Mark any existing connected row for google_calendar as disconnected to honor the
  // partial unique index. Multiple disconnected rows allowed; single connected row enforced.
  await sb
    .schema("agentos")
    .from("tool_connections")
    .update({
      status: "disconnected",
      disconnected_at: new Date().toISOString(),
    })
    .eq("integration", "google_calendar")
    .eq("status", "connected");

  // Insert fresh connected row.
  const { data: connectionRow, error: insertErr } = await sb
    .schema("agentos")
    .from("tool_connections")
    .insert({
      integration: "google_calendar",
      connection_method: "anthropic_hosted",
      external_ref: null,
      status: "connected",
      connected_by: userId,
      metadata: {
        access_token_ciphertext: accessTokenCiphertext,
        refresh_token_ciphertext: refreshTokenCiphertext,
        expires_at: expiresAt,
        scopes: grantedScopes.length > 0 ? grantedScopes : PHASE_6_CALENDAR_SCOPES,
        token_type: tokenResp.token_type ?? "Bearer",
      },
    })
    .select("id")
    .single();

  if (insertErr || !connectionRow) {
    return NextResponse.json(
      {
        error: "tool_connection_insert_failed",
        detail: insertErr?.message,
      },
      { status: 500 },
    );
  }

  // 6. Audit log row — column is `action` (an enum-typed column). Per STATE.md drift
  //    note: never write the camelCase `actionType` form to this row; the column name
  //    is exactly `action`.
  await sb
    .schema("agentos")
    .from("audit_logs")
    .insert({
      user_id: userId,
      action: 'tool_connection_create',
      target_id: connectionRow.id,
      before: null,
      after: {
        integration: "google_calendar",
        scopes: grantedScopes,
        expires_at: expiresAt,
      },
    });

  // 7. Redirect to tools page with success flag.
  return NextResponse.redirect(
    new URL(`/agentos/tools?connected=google_calendar`, url.origin),
  );
}
