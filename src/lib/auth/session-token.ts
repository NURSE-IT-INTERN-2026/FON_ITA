import { createHash, randomBytes } from "node:crypto";

// Opaque token + DB session (decisions.md D2). The token carries no data — it is
// a random string whose SHA-256 hash is the primary key of the `sessions` row.
// Nothing here signs or encrypts, so no secret is involved.

// Cookie name/path/sameSite live in session-cookie.ts — proxy.ts needs them and
// must not import `node:crypto`.

const SESSION_MAX_AGE_DAYS = Number(process.env.SESSION_MAX_AGE_DAYS ?? 30);

/** The raw token. Handed to the client in a cookie and never stored. */
export function generateSessionToken(): string {
  return randomBytes(32).toString("base64url");
}

/**
 * What goes in the database. A plain SHA-256 is correct here — the input is
 * already 256 bits of entropy, so a salt or a slow KDF would add nothing
 * (unlike passwords, which are low-entropy and need scrypt).
 */
export function hashSessionToken(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}

export function getSessionExpiry(): Date {
  return new Date(Date.now() + SESSION_MAX_AGE_DAYS * 24 * 60 * 60 * 1000);
}
