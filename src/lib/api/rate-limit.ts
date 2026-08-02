// Throttling for the frozen Public API (F27/F28).
//
// The old system runs Laravel's `throttle:60,1` on the whole `api` middleware
// group, so the two endpoints share ONE counter per client. Verified against
// the live system: calling /api/v1/ita drops the X-RateLimit-Remaining that
// /api/nurse/youtube-feed reports next. Keeping them separate would hand out a
// larger budget than the contract advertises.

export const RATE_LIMIT = 60;
const WINDOW_MS = 60_000;

type Bucket = { count: number; resetAt: number };

// In-process, which is the honest scope of this: with several Node instances
// behind the reverse proxy each gets its own budget. That matches how the old
// single-server deployment behaved and needs no extra infrastructure — if the
// app is ever scaled out, this has to move to a shared store.
const buckets = new Map<string, Bucket>();

/** Drop expired buckets so a stream of one-off IPs cannot grow the map forever. */
function prune(now: number): void {
  for (const [key, bucket] of buckets) {
    if (bucket.resetAt <= now) buckets.delete(key);
  }
}

export type RateLimitResult = {
  allowed: boolean;
  limit: number;
  remaining: number;
  /** Whole seconds until the window resets — only meaningful when blocked. */
  retryAfter: number;
};

/**
 * Count one request against `key`'s budget.
 *
 * Fixed window rather than sliding, because that is what Laravel does and the
 * numbers in the headers should mean the same thing they did before.
 */
export function consumeRateLimit(key: string): RateLimitResult {
  const now = Date.now();
  if (buckets.size > 5_000) prune(now);

  const bucket = buckets.get(key);
  if (!bucket || bucket.resetAt <= now) {
    buckets.set(key, { count: 1, resetAt: now + WINDOW_MS });
    return { allowed: true, limit: RATE_LIMIT, remaining: RATE_LIMIT - 1, retryAfter: 0 };
  }

  const retryAfter = Math.max(1, Math.ceil((bucket.resetAt - now) / 1000));
  if (bucket.count >= RATE_LIMIT) {
    return { allowed: false, limit: RATE_LIMIT, remaining: 0, retryAfter };
  }

  bucket.count += 1;
  return { allowed: true, limit: RATE_LIMIT, remaining: RATE_LIMIT - bucket.count, retryAfter };
}

/**
 * True when the browser says this request came from our own pages.
 *
 * The 60/min budget was sized for the old world, where the only caller was the
 * faculty web server. Now the landing page calls the same endpoints from the
 * visitor's browser, and a whole faculty can sit behind one NAT address — a few
 * dozen people opening the page in the same minute would lock each other out.
 * Requests carrying `Sec-Fetch-Site: same-origin` are still counted, so the
 * headers stay meaningful, but they are not turned away.
 *
 * A header a browser sets, so this is a fairness knob and not a security
 * control: `curl` can claim same-origin, exactly as it can claim any
 * `X-Forwarded-For`. Nothing behind these endpoints is protected by the limit.
 */
export function sameOrigin(request: Request): boolean {
  return request.headers.get("sec-fetch-site") === "same-origin";
}

/**
 * Best-effort client identity.
 *
 * The app sits behind the faculty's nginx, so the socket address is always the
 * proxy — `x-forwarded-for` is the only useful signal. It is client-supplied
 * and therefore spoofable; that is acceptable here because this endpoint is
 * public and read-only, and the limit exists to stop accidental hammering, not
 * a determined attacker.
 */
export function clientKey(request: Request): string {
  const forwarded = request.headers.get("x-forwarded-for");
  // Left-most entry is the original client; the rest are proxies.
  const first = forwarded?.split(",")[0]?.trim();
  return first || request.headers.get("x-real-ip")?.trim() || "unknown";
}
