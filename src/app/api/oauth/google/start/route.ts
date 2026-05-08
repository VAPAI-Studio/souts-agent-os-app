/**
 * Phase 7 / Plan 07-01 — Google OAuth start endpoint.
 *
 * Reads ?integration= query param to pick scope set:
 *   integration=google_calendar  → calendar full scope (read + write)
 *   integration=gmail            → gmail.readonly + gmail.send (Plan 07-02 reuses)
 *   integration=google_drive     → drive scope (Plan 07-03 reuses)
 *
 * Sets google_oauth_state CSRF cookie + google_oauth_integration cookie, then
 * redirects to Google's consent screen with access_type=offline & prompt=consent
 * to guarantee a refresh_token is returned.
 *
 * The callback at /api/oauth/google/callback reads google_oauth_integration to
 * know which integration row to upsert — replaces the hardcoded 'google_calendar'
 * literal from Phase 6's callback.
 *
 * B1 invariant: redirect_uri is process.env.GOOGLE_REDIRECT_URI for ALL
 * integration flows — do NOT introduce per-integration redirect URIs.
 */
import { randomBytes } from "node:crypto";
import { cookies } from "next/headers";
import { NextResponse } from "next/server";

const STATE_COOKIE = "google_oauth_state";
const INTEGRATION_COOKIE = "google_oauth_integration";
const GOOGLE_AUTHORIZE_URL = "https://accounts.google.com/o/oauth2/v2/auth";

const SCOPES_BY_INTEGRATION: Record<string, string[]> = {
  google_calendar: ["https://www.googleapis.com/auth/calendar"],
  gmail: [
    "https://www.googleapis.com/auth/gmail.readonly",
    "https://www.googleapis.com/auth/gmail.send",
  ],
  google_drive: ["https://www.googleapis.com/auth/drive"],
};

export async function GET(request: Request): Promise<Response> {
  const url = new URL(request.url);
  const integration = url.searchParams.get("integration") ?? "google_calendar";
  const scopes = SCOPES_BY_INTEGRATION[integration];
  if (!scopes) {
    return NextResponse.json(
      {
        error: "unsupported_integration",
        supported: Object.keys(SCOPES_BY_INTEGRATION),
      },
      { status: 400 },
    );
  }

  const clientId = process.env.GOOGLE_CLIENT_ID;
  const redirectUri = process.env.GOOGLE_REDIRECT_URI;
  if (!clientId || !redirectUri) {
    return NextResponse.json(
      {
        error: "google_oauth_not_configured",
        missing: { clientId: !clientId, redirectUri: !redirectUri },
      },
      { status: 500 },
    );
  }

  const state = randomBytes(24).toString("hex");
  const cookieStore = await cookies();

  // CSRF state cookie — single-use, 10-minute TTL.
  cookieStore.set(STATE_COOKIE, state, {
    httpOnly: true,
    secure: true,
    sameSite: "lax",
    path: "/",
    maxAge: 600,
  });

  // Integration cookie — read by callback to select the integration key for
  // the tool_connections upsert. Same TTL/flags as state cookie.
  cookieStore.set(INTEGRATION_COOKIE, integration, {
    httpOnly: true,
    secure: true,
    sameSite: "lax",
    path: "/",
    maxAge: 600,
  });

  const u = new URL(GOOGLE_AUTHORIZE_URL);
  u.searchParams.set("client_id", clientId);
  u.searchParams.set("redirect_uri", redirectUri);
  u.searchParams.set("response_type", "code");
  u.searchParams.set("scope", scopes.join(" "));
  // access_type=offline guarantees a refresh_token is returned.
  // prompt=consent forces Google to always show the consent screen and
  // re-issue a refresh_token even if the user has previously connected.
  u.searchParams.set("access_type", "offline");
  u.searchParams.set("prompt", "consent");
  u.searchParams.set("state", state);

  return NextResponse.redirect(u.toString());
}
