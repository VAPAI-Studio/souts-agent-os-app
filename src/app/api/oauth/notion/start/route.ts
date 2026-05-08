/**
 * Phase 7 / Plan 07-04 — Notion OAuth start (PKCE + DCR flow).
 *
 * Sets TWO cookies (state for CSRF + verifier for PKCE) then redirects to
 * mcp.notion.com/authorize. The callback at /api/oauth/notion/callback verifies
 * BOTH cookies before attempting the token exchange.
 *
 * Cookie contract:
 *   - notion_oauth_state   : random hex, CSRF protection (matched against ?state at callback)
 *   - notion_oauth_verifier: PKCE code_verifier (required for token exchange at callback)
 *
 * Required env vars:
 *   - NOTION_CLIENT_ID    (from register_notion_dcr.py one-shot output)
 *   - NOTION_REDIRECT_URI (https://<APP_BASE_URL>/api/oauth/notion/callback)
 *
 * W3 fix: callback enforces that BOTH cookies are present before token exchange.
 * Missing verifier cookie → 400 missing_verifier (token exchange NOT attempted).
 */
import { randomBytes } from "node:crypto";
import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { generatePkcePair } from "@/lib/notion_oauth";

const STATE_COOKIE = "notion_oauth_state";
const VERIFIER_COOKIE = "notion_oauth_verifier";
const NOTION_AUTHORIZE_URL = "https://mcp.notion.com/authorize";

export async function GET(): Promise<Response> {
  const clientId = process.env.NOTION_CLIENT_ID;
  const redirectUri = process.env.NOTION_REDIRECT_URI;
  if (!clientId || !redirectUri) {
    return NextResponse.json(
      {
        error: "notion_oauth_not_configured",
        missing: { clientId: !clientId, redirectUri: !redirectUri },
      },
      { status: 500 },
    );
  }

  const state = randomBytes(24).toString("hex");
  const { verifier, challenge, method } = generatePkcePair();

  const cookieStore = await cookies();
  const cookieOpts = {
    httpOnly: true,
    secure: true,
    sameSite: "lax" as const,
    path: "/",
    maxAge: 600, // 10 minutes — more than enough for the OAuth round-trip
  };
  cookieStore.set(STATE_COOKIE, state, cookieOpts);
  cookieStore.set(VERIFIER_COOKIE, verifier, cookieOpts);

  const u = new URL(NOTION_AUTHORIZE_URL);
  u.searchParams.set("client_id", clientId);
  u.searchParams.set("redirect_uri", redirectUri);
  u.searchParams.set("response_type", "code");
  u.searchParams.set("state", state);
  u.searchParams.set("code_challenge", challenge);
  u.searchParams.set("code_challenge_method", method);
  // owner=user → user-level OAuth so the integration sees the workspaces the
  // user picks in the Notion consent screen (user chooses which pages/DBs to share).
  u.searchParams.set("owner", "user");

  return NextResponse.redirect(u.toString());
}
