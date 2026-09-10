import { randomBytes, timingSafeEqual } from "node:crypto";
import { cookies } from "next/headers";
import { SESSION_COOKIE_PATH, SESSION_COOKIE_SAMESITE } from "@/lib/auth/session-cookie";

// CSRF protection for the OAuth round trip: a random value is parked in a
// short-lived cookie before the browser leaves for Microsoft, and the callback
// only proceeds if the returned `state` matches it. Without this, an attacker
// can feed their own authorization code to the callback and sign the victim
// into the attacker's account.

// Prefixed because cookies are host-scoped, not port-scoped: another app on
// localhost (e.g. a local prototype) plants `oauth_state` at path=/, and Next.js
// resolves duplicate cookie names last-wins — the foreign path=/ cookie would
// shadow ours and every CMU login would die with oauth_state_mismatch.
const OAUTH_STATE_COOKIE = "fonita_oauth_state";

// 10 minutes — long enough to finish a Microsoft login, short enough that an
// abandoned attempt cannot be replayed later.
const OAUTH_STATE_MAX_AGE = 60 * 10;

export function generateOauthState(): string {
  return randomBytes(16).toString("hex");
}

export async function setOauthStateCookie(state: string): Promise<void> {
  const cookieStore = await cookies();
  cookieStore.set(OAUTH_STATE_COOKIE, state, {
    httpOnly: true,
    sameSite: SESSION_COOKIE_SAMESITE,
    secure: process.env.NODE_ENV === "production",
    // Same path as the session cookie, or the callback never receives it.
    path: SESSION_COOKIE_PATH,
    maxAge: OAUTH_STATE_MAX_AGE,
  });
}

/**
 * Read the state and delete it in the same step — one attempt per cookie, so a
 * captured `code`+`state` pair cannot be replayed. Deleting on every path
 * (including failures) is deliberate.
 */
export async function consumeOauthStateCookie(): Promise<string | null> {
  const cookieStore = await cookies();
  const state = cookieStore.get(OAUTH_STATE_COOKIE)?.value ?? null;
  cookieStore.delete({ name: OAUTH_STATE_COOKIE, path: SESSION_COOKIE_PATH });
  return state;
}

/** Constant-time compare, per the project's rule for every secret comparison. */
export function matchesOauthState(
  fromQuery: string | null,
  fromCookie: string | null,
): boolean {
  if (!fromQuery || !fromCookie) return false;
  const a = Buffer.from(fromQuery);
  const b = Buffer.from(fromCookie);
  // timingSafeEqual throws on a length mismatch, so check that first.
  return a.length === b.length && timingSafeEqual(a, b);
}
