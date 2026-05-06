/**
 * Phase 6 / Plan 06-01b: Google OAuth helpers — token exchange + refresh.
 *
 * Used by the Google Calendar OAuth callback to exchange an authorization code for
 * an access_token + refresh_token, and to refresh expired access tokens via the
 * stored refresh_token. Tokens are encrypted (encryption.ts:encryptToken) before
 * being persisted to agentos.tool_connections.metadata.
 *
 * Required env vars:
 *   - GOOGLE_CLIENT_ID      OAuth 2.0 Client ID from Google Cloud Console
 *   - GOOGLE_CLIENT_SECRET  OAuth 2.0 Client Secret
 *   - GOOGLE_REDIRECT_URI   Authorized redirect URI registered in Google Cloud Console
 *
 * Token endpoint: https://oauth2.googleapis.com/token (Google's universal OAuth 2.0
 * token endpoint — same URL for both authorization_code and refresh_token grants).
 *
 * Refresh strategy (RESEARCH §2d): access_token expires in 3600s (1h). COO runs are
 * <5 min so most runs see fresh tokens, but the runner refreshes on 401 using the
 * stored refresh_token. The OAuth callback MUST be initiated with
 * `access_type=offline&prompt=consent` to receive a refresh_token.
 */

export interface GoogleTokenResponse {
  access_token: string;
  refresh_token?: string;
  expires_in: number;
  token_type: string;
  scope: string;
}

const GOOGLE_TOKEN_URL = "https://oauth2.googleapis.com/token";

/**
 * Exchange an OAuth authorization code for an access_token + refresh_token.
 *
 * @param code         The 'code' query param from the OAuth redirect.
 * @param redirectUri  The redirect_uri registered in Google Cloud Console (must match).
 * @returns            Google's token response. refresh_token is present iff the
 *                     authorization URL included access_type=offline&prompt=consent.
 * @throws             Error on non-2xx response from Google.
 */
export async function exchangeAuthCodeForToken(
  code: string,
  redirectUri: string,
): Promise<GoogleTokenResponse> {
  const clientId = process.env.GOOGLE_CLIENT_ID;
  const clientSecret = process.env.GOOGLE_CLIENT_SECRET;
  if (!clientId || !clientSecret) {
    throw new Error(
      "GOOGLE_CLIENT_ID / GOOGLE_CLIENT_SECRET env vars are required for OAuth code exchange",
    );
  }
  const resp = await fetch(GOOGLE_TOKEN_URL, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      code,
      client_id: clientId,
      client_secret: clientSecret,
      redirect_uri: redirectUri,
      grant_type: "authorization_code",
    }),
  });
  if (!resp.ok) {
    throw new Error(
      `Google token exchange failed: ${resp.status} ${await resp.text()}`,
    );
  }
  return (await resp.json()) as GoogleTokenResponse;
}

/**
 * Refresh an expired access_token using the stored refresh_token.
 *
 * Google does NOT rotate refresh tokens by default — the same refresh_token can be
 * reused indefinitely until the user revokes consent. The response contains a fresh
 * access_token + expires_in (typically 3600s).
 *
 * @param refreshToken  The refresh_token from the original auth-code exchange.
 * @returns             New access_token + expires_in. refresh_token field is usually
 *                      omitted on refresh responses.
 * @throws              Error on non-2xx response (typically 400 invalid_grant if the
 *                      user revoked consent or the refresh_token is malformed).
 */
export async function refreshAccessToken(
  refreshToken: string,
): Promise<GoogleTokenResponse> {
  const clientId = process.env.GOOGLE_CLIENT_ID;
  const clientSecret = process.env.GOOGLE_CLIENT_SECRET;
  if (!clientId || !clientSecret) {
    throw new Error(
      "GOOGLE_CLIENT_ID / GOOGLE_CLIENT_SECRET env vars are required for OAuth refresh",
    );
  }
  const resp = await fetch(GOOGLE_TOKEN_URL, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      refresh_token: refreshToken,
      client_id: clientId,
      client_secret: clientSecret,
      grant_type: "refresh_token",
    }),
  });
  if (!resp.ok) {
    throw new Error(
      `Google token refresh failed: ${resp.status} ${await resp.text()}`,
    );
  }
  return (await resp.json()) as GoogleTokenResponse;
}
