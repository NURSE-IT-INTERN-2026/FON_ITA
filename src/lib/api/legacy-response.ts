// Shared pieces of the frozen Public API contract (docs/chapters/05-public-api.md).
//
// Everything here exists to reproduce what the Laravel 8 system returns, byte
// for byte where it matters. The faculty website at
// https://www.nurse.cmu.ac.th/web/Info.aspx consumes it directly, so a
// "cleaner" shape is a breaking change.

import type { RateLimitResult } from "./rate-limit";

/**
 * Laravel serializes timestamps with SIX fractional digits (`2025-03-13T02:51:21.000000Z`);
 * `Date.toISOString()` gives three. The extra zeros are padding, not precision —
 * but a consumer parsing the string by position would still notice.
 */
export function legacyTimestamp(date: Date): string {
  return date.toISOString().replace(/Z$/, "000Z");
}

/**
 * Headers the old system sends on every API response, minus the ones nginx and
 * the outer IIS layer add on their own (HSTS, X-Frame-Options, …).
 *
 * `Cache-Control: private, must-revalidate` + `Pragma`/`Expires` is Laravel's
 * default for a session-less API response. It is deliberately uncached: the
 * faculty page must see an edit as soon as it is published.
 */
export function legacyHeaders(rate: RateLimitResult, origin: string): Headers {
  return new Headers({
    "Content-Type": "application/json",
    "Cache-Control": "private, must-revalidate",
    Pragma: "no-cache",
    Expires: "-1",
    "X-RateLimit-Limit": String(rate.limit),
    "X-RateLimit-Remaining": String(rate.remaining),
    "Access-Control-Allow-Origin": origin,
    "X-Content-Type-Options": "nosniff",
  });
}

/** Laravel's ThrottleRequests response, so a throttled consumer sees what it always did. */
export function tooManyRequests(rate: RateLimitResult, origin: string): Response {
  const headers = legacyHeaders(rate, origin);
  headers.set("Retry-After", String(rate.retryAfter));
  return new Response(JSON.stringify({ message: "Too Many Attempts." }), {
    status: 429,
    headers,
  });
}
