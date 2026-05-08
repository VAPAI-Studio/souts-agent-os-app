/**
 * Phase 7 / Plan 07-04 — Notion OAuth helpers (PKCE + token exchange + refresh).
 *
 * Notion uses OAuth 2.1 PKCE; client_id/client_secret obtained via one-shot DCR
 * (see souts-agent-os-modal/scripts/register_notion_dcr.py).
 *
 * Key differences from Google OAuth:
 *   - Uses PKCE (code_verifier + code_challenge, method S256) — no client_secret_basic,
 *     uses client_secret_post.
 *   - No refresh_token required for Phase 7 if Notion token TTL is long. refreshNotionToken
 *     is provided for completeness but not called by runner.py in Phase 7.
 *   - Authorization endpoint: https://mcp.notion.com/authorize
 *   - Token endpoint: https://mcp.notion.com/token
 *
 * Exported:
 *   - generatePkcePair() → { verifier, challenge, method: "S256" }
 *   - exchangeNotionCode(code, codeVerifier, redirectUri) → NotionTokenResponse
 *   - refreshNotionToken(refreshToken) → NotionTokenResponse
 */
import { randomBytes, createHash } from "node:crypto";

export interface PkcePair {
  verifier: string;
  challenge: string;
  method: "S256";
}

/**
 * Generate a PKCE code_verifier + code_challenge pair.
 *
 * Per RFC 7636 + Notion's oauth2_pkce auth_flow:
 *   - code_verifier = randomBytes(32).toString("base64url")  — 43-char base64url string
 *   - code_challenge = SHA256(verifier) encoded as base64url
 *   - code_challenge_method = "S256" (Notion ONLY supports S256, NOT plain)
 */
export function generatePkcePair(): PkcePair {
  const verifier = randomBytes(32).toString("base64url");
  const challenge = createHash("sha256").update(verifier).digest("base64url");
  return { verifier, challenge, method: "S256" };
}

export interface NotionTokenResponse {
  access_token: string;
  refresh_token?: string;
  expires_in?: number;
  token_type?: string;
  scope?: string;
  workspace_id?: string;
  workspace_name?: string;
  workspace_icon?: string;
  bot_id?: string;
}

const NOTION_TOKEN_URL = "https://mcp.notion.com/token";

/**
 * Exchange an authorization code for a Notion access_token.
 *
 * Uses client_secret_post auth method (includes client_id + client_secret in the body,
 * not the Authorization header). Requires NOTION_CLIENT_ID + NOTION_CLIENT_SECRET env vars.
 *
 * @param code  — authorization code from the ?code query param at callback
 * @param codeVerifier — the PKCE code_verifier stored in the notion_oauth_verifier cookie
 * @param redirectUri — must exactly match the redirect_uri used in the authorization request
 */
export async function exchangeNotionCode(
  code: string,
  codeVerifier: string,
  redirectUri: string,
): Promise<NotionTokenResponse> {
  const clientId = process.env.NOTION_CLIENT_ID;
  const clientSecret = process.env.NOTION_CLIENT_SECRET;
  if (!clientId || !clientSecret) {
    throw new Error(
      "NOTION_CLIENT_ID / NOTION_CLIENT_SECRET env vars required. " +
        "Run souts-agent-os-modal/scripts/register_notion_dcr.py once and paste output to env vars.",
    );
  }
  const body = new URLSearchParams({
    grant_type: "authorization_code",
    code,
    code_verifier: codeVerifier,
    redirect_uri: redirectUri,
    client_id: clientId,
    client_secret: clientSecret,
  });
  const r = await fetch(NOTION_TOKEN_URL, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: body.toString(),
  });
  if (!r.ok) {
    throw new Error(`Notion token exchange failed: ${r.status} ${await r.text()}`);
  }
  return (await r.json()) as NotionTokenResponse;
}

/**
 * Refresh a Notion access_token using a stored refresh_token.
 *
 * Phase 7 note: not called by runner.py in Phase 7 (Notion token TTL may be long).
 * Provided for completeness and future Phase 7.5+ use.
 */
export async function refreshNotionToken(refreshToken: string): Promise<NotionTokenResponse> {
  const clientId = process.env.NOTION_CLIENT_ID;
  const clientSecret = process.env.NOTION_CLIENT_SECRET;
  if (!clientId || !clientSecret) {
    throw new Error("NOTION_CLIENT_ID / NOTION_CLIENT_SECRET env vars required");
  }
  const body = new URLSearchParams({
    grant_type: "refresh_token",
    refresh_token: refreshToken,
    client_id: clientId,
    client_secret: clientSecret,
  });
  const r = await fetch(NOTION_TOKEN_URL, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: body.toString(),
  });
  if (!r.ok) {
    throw new Error(`Notion token refresh failed: ${r.status} ${await r.text()}`);
  }
  return (await r.json()) as NotionTokenResponse;
}
