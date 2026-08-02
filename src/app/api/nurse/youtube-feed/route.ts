import { legacyHeaders, tooManyRequests } from "@/lib/api/legacy-response";
import { clientKey, consumeRateLimit } from "@/lib/api/rate-limit";
import { loadYoutubeFeed, type YoutubeFeedEntry } from "@/lib/youtube/feed";

/**
 * GET /api/nurse/youtube-feed  (real path: /fonita/api/nurse/youtube-feed)
 *
 * FROZEN contract — see docs/chapters/05-public-api.md §6.2. Proxies the
 * faculty YouTube channel's Atom feed and returns the two newest videos.
 *
 * The proxy exists because the browser cannot read youtube.com's feed directly:
 * it sends no CORS headers. The response shape is whatever PHP's
 * `json_encode(simplexml_load_string(...))` produced, quirks included.
 *
 * Fetch + parse logic is shared with the home page through
 * `@/lib/youtube/feed` — both views show the same data.
 */

// Narrower than /api/v1/ita, which answers "*". Matched to the live system.
const CORS_ORIGIN = "https://www.nurse.cmu.ac.th";
const CORS_METHODS = "GET";
const CORS_HEADERS = "X-Requested-With, Content-Type, X-Token-Auth, Authorization";

export async function GET(request: Request) {
  const rate = consumeRateLimit(clientKey(request));
  if (!rate.allowed) return tooManyRequests(rate, CORS_ORIGIN);

  const entries: YoutubeFeedEntry[] = await loadYoutubeFeed();

  const headers = legacyHeaders(rate, CORS_ORIGIN);
  headers.set("Access-Control-Allow-Methods", CORS_METHODS);
  headers.set("Access-Control-Allow-Headers", CORS_HEADERS);

  return new Response(JSON.stringify(entries), { status: 200, headers });
}

export function OPTIONS() {
  return new Response(null, {
    status: 204,
    headers: {
      "Access-Control-Allow-Origin": CORS_ORIGIN,
      "Access-Control-Allow-Methods": CORS_METHODS,
      "Access-Control-Allow-Headers": CORS_HEADERS,
    },
  });
}
