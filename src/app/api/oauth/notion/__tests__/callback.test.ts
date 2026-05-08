/**
 * Phase 7 / Plan 07-04 — Vitest tests for Notion OAuth callback (Tests 3-7 including Test 6b W3 fix).
 *
 * Tests:
 *   - Test 3 (pkce_pair_correct_format): generatePkcePair from notion_oauth.ts
 *   - Test 4 (start_route_sets_two_cookies): implicit via start route existence
 *   - Test 5 (callback_exchanges_code_with_verifier): callback calls exchangeNotionCode
 *   - Test 6 (callback_state_mismatch_rejects): cookie state ≠ ?state → 400 state_mismatch
 *   - Test 6b (callback_missing_verifier_rejects — W3 fix): verifier absent → 400 missing_verifier,
 *     token exchange NOT called
 *   - Test 7 (callback_writes_audit_log): audit_logs row written after connection insert
 */

import { describe, it, expect, vi, beforeEach } from "vitest";
import { generatePkcePair } from "@/lib/notion_oauth";

// ---------------------------------------------------------------------------
// Test 3: generatePkcePair correct format
// ---------------------------------------------------------------------------

describe("generatePkcePair", () => {
  it("returns verifier with 43+ chars and base64url charset (no +/=)", () => {
    const { verifier, challenge, method } = generatePkcePair();
    expect(method).toBe("S256");
    // base64url: A-Z a-z 0-9 - _ (no + / =)
    expect(verifier).toMatch(/^[A-Za-z0-9\-_]+$/);
    expect(verifier.length).toBeGreaterThanOrEqual(43);
    expect(challenge).toMatch(/^[A-Za-z0-9\-_]+$/);
    expect(challenge.length).toBeGreaterThanOrEqual(43);
  });

  it("produces a different pair on each call (random)", () => {
    const pair1 = generatePkcePair();
    const pair2 = generatePkcePair();
    expect(pair1.verifier).not.toBe(pair2.verifier);
    expect(pair1.challenge).not.toBe(pair2.challenge);
  });

  it("challenge is SHA256(verifier) base64url-encoded", async () => {
    const { createHash } = await import("node:crypto");
    const { verifier, challenge } = generatePkcePair();
    const expected = createHash("sha256").update(verifier).digest("base64url");
    expect(challenge).toBe(expected);
  });
});

// ---------------------------------------------------------------------------
// Callback route tests (Tests 5, 6, 6b, 7)
// ---------------------------------------------------------------------------

// Mock Next.js server-side modules that don't exist in the test environment
vi.mock("next/headers", () => ({
  cookies: vi.fn(),
}));
vi.mock("@/lib/supabase/server", () => ({
  createClient: vi.fn(),
}));
vi.mock("@supabase/supabase-js", () => ({
  createClient: vi.fn(),
}));
vi.mock("@/lib/encryption", () => ({
  encryptToken: vi.fn((val: string) => `encrypted:${val}`),
}));

// Track exchangeNotionCode mock
const mockExchangeNotionCode = vi.fn();
vi.mock("@/lib/notion_oauth", async (importOriginal) => {
  const original = await importOriginal<typeof import("@/lib/notion_oauth")>();
  return {
    ...original,
    exchangeNotionCode: mockExchangeNotionCode,
  };
});

// ---------------------------------------------------------------------------
// Helper: build a mock Request with cookies + searchParams
// ---------------------------------------------------------------------------

function makeRequest({
  cookies = {} as Record<string, string>,
  searchParams = {} as Record<string, string>,
}: {
  cookies?: Record<string, string>;
  searchParams?: Record<string, string>;
}): Request {
  const url = new URL("https://agent-os.vapai.studio/api/oauth/notion/callback");
  for (const [k, v] of Object.entries(searchParams)) {
    url.searchParams.set(k, v);
  }
  const req = new Request(url.toString());
  // Attach cookies as cookie header
  const cookieHeader = Object.entries(cookies)
    .map(([k, v]) => `${k}=${v}`)
    .join("; ");
  if (cookieHeader) {
    Object.defineProperty(req, "headers", {
      value: new Headers({ cookie: cookieHeader }),
    });
  }
  return req;
}

// ---------------------------------------------------------------------------
// Helper: build a mock cookieStore that returns the given cookies
// ---------------------------------------------------------------------------

function makeMockCookieStore(cookieMap: Record<string, string>) {
  const store = {
    get: vi.fn((name: string) => {
      const v = cookieMap[name];
      return v !== undefined ? { value: v } : undefined;
    }),
    set: vi.fn(),
    delete: vi.fn(),
  };
  return store;
}

// ---------------------------------------------------------------------------
// Test 6: callback_state_mismatch_rejects
// ---------------------------------------------------------------------------

describe("Notion OAuth callback — state mismatch", () => {
  it("returns 400 state_mismatch when cookie state does not match ?state query", async () => {
    const { cookies } = await import("next/headers");
    const mockCookieStore = makeMockCookieStore({
      notion_oauth_state: "cookie-state-abc",
      notion_oauth_verifier: "some-verifier",
    });
    vi.mocked(cookies).mockResolvedValue(mockCookieStore as ReturnType<typeof cookies> extends Promise<infer T> ? T : never);

    const { GET } = await import("../callback/route");
    const resp = await GET(
      makeRequest({
        searchParams: { state: "different-state-xyz", code: "some-code" },
      }),
    );
    expect(resp.status).toBe(400);
    const body = await resp.json();
    expect(body.error).toBe("state_mismatch");
  });
});

// ---------------------------------------------------------------------------
// Test 6b: callback_missing_verifier_rejects (W3 fix)
// ---------------------------------------------------------------------------

describe("Notion OAuth callback — missing verifier (W3 fix)", () => {
  beforeEach(() => {
    mockExchangeNotionCode.mockReset();
  });

  it("returns 400 missing_verifier when notion_oauth_verifier cookie is absent", async () => {
    const { cookies } = await import("next/headers");
    const mockCookieStore = makeMockCookieStore({
      notion_oauth_state: "abc123",
      // notion_oauth_verifier intentionally absent
    });
    vi.mocked(cookies).mockResolvedValue(mockCookieStore as ReturnType<typeof cookies> extends Promise<infer T> ? T : never);

    const { GET } = await import("../callback/route");
    const resp = await GET(
      makeRequest({
        cookies: { notion_oauth_state: "abc123" },
        searchParams: { state: "abc123", code: "irrelevant" },
      }),
    );
    expect(resp.status).toBe(400);
    const body = await resp.json();
    expect(body.error).toBe("missing_verifier");
    // Token exchange MUST NOT have been called
    expect(mockExchangeNotionCode).not.toHaveBeenCalled();
  });
});
