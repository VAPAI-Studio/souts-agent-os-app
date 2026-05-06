/**
 * Phase 6 / Plan 06-01: AES-256-GCM token encryption for OAuth credentials.
 *
 * Used by the Slack OAuth callback to encrypt access tokens before writing them to
 * agentos.tool_connections.metadata.access_token_ciphertext. The Modal runner reads
 * the same field via service-role and decrypts using the matching Python helper
 * (souts-agent-os-modal/runner.py:_decrypt_token).
 *
 * Key sourcing:
 *   - Read from process.env.TOOL_TOKEN_ENCRYPTION_KEY (32-byte base64-encoded key).
 *   - Generate with: `openssl rand -base64 32`
 *   - Store the SAME value in BOTH:
 *       (a) Vercel env vars (this app reads it during OAuth callback)
 *       (b) Modal Secret `souts-agent-os-secrets` (runner.py reads it on every run)
 *
 * Format:
 *   ciphertext = "{iv_b64}.{ct_b64}.{tag_b64}"
 *
 *   - iv: 12 bytes (96 bits) — GCM standard nonce length, base64-encoded
 *   - ct: encrypted payload, base64-encoded
 *   - tag: 16-byte (128-bit) GCM auth tag, base64-encoded
 *
 * Why dot-separated string instead of JSON: smaller, no escaping concerns when stored
 * inside a jsonb column, easy to split() in both Node and Python.
 */
import { createCipheriv, createDecipheriv, randomBytes } from "node:crypto";

const ALGORITHM = "aes-256-gcm";
const IV_LENGTH_BYTES = 12; // 96 bits — GCM standard
const TAG_LENGTH_BYTES = 16; // 128 bits — GCM standard

function getKey(): Buffer {
  const raw = process.env.TOOL_TOKEN_ENCRYPTION_KEY;
  if (!raw) {
    throw new Error(
      "TOOL_TOKEN_ENCRYPTION_KEY env var is required. " +
        "Generate with `openssl rand -base64 32` and set in Vercel + Modal Secret."
    );
  }
  const key = Buffer.from(raw, "base64");
  if (key.length !== 32) {
    throw new Error(
      `TOOL_TOKEN_ENCRYPTION_KEY must decode to 32 bytes (got ${key.length}). ` +
        "Generate with `openssl rand -base64 32`."
    );
  }
  return key;
}

/**
 * Encrypt a plaintext token (e.g., Slack OAuth bearer) for storage in tool_connections.metadata.
 *
 * Returns the dot-separated ciphertext string: "{iv}.{ct}.{tag}".
 */
export function encryptToken(plaintext: string): string {
  if (typeof plaintext !== "string" || plaintext.length === 0) {
    throw new Error("encryptToken: plaintext must be a non-empty string");
  }
  const key = getKey();
  const iv = randomBytes(IV_LENGTH_BYTES);
  const cipher = createCipheriv(ALGORITHM, key, iv);
  const ciphertext = Buffer.concat([
    cipher.update(plaintext, "utf8"),
    cipher.final(),
  ]);
  const tag = cipher.getAuthTag();
  return [
    iv.toString("base64"),
    ciphertext.toString("base64"),
    tag.toString("base64"),
  ].join(".");
}

/**
 * Decrypt a ciphertext blob produced by encryptToken().
 *
 * Throws on tampering (GCM auth tag mismatch) or malformed input.
 */
export function decryptToken(ciphertextBlob: string): string {
  if (typeof ciphertextBlob !== "string" || ciphertextBlob.length === 0) {
    throw new Error("decryptToken: ciphertextBlob must be a non-empty string");
  }
  const parts = ciphertextBlob.split(".");
  if (parts.length !== 3) {
    throw new Error(
      `decryptToken: malformed ciphertext (expected iv.ct.tag, got ${parts.length} parts)`
    );
  }
  const [ivB64, ctB64, tagB64] = parts;
  const key = getKey();
  const iv = Buffer.from(ivB64, "base64");
  const ct = Buffer.from(ctB64, "base64");
  const tag = Buffer.from(tagB64, "base64");
  if (iv.length !== IV_LENGTH_BYTES) {
    throw new Error(
      `decryptToken: iv length must be ${IV_LENGTH_BYTES} bytes, got ${iv.length}`
    );
  }
  if (tag.length !== TAG_LENGTH_BYTES) {
    throw new Error(
      `decryptToken: auth tag length must be ${TAG_LENGTH_BYTES} bytes, got ${tag.length}`
    );
  }
  const decipher = createDecipheriv(ALGORITHM, key, iv);
  decipher.setAuthTag(tag);
  const plaintext = Buffer.concat([decipher.update(ct), decipher.final()]);
  return plaintext.toString("utf8");
}
