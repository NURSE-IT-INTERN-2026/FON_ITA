import { legacyHeaders, tooManyRequests } from "@/lib/api/legacy-response";
import { clientKey, consumeRateLimit, sameOrigin } from "@/lib/api/rate-limit";
import { listItaYears } from "@/lib/ita/queries";

/**
 * GET /api/v1/ita-years  (real path: /fonita/api/v1/ita-years)
 *
 * Every พ.ศ. year that has at least one ITA topic, newest first:
 *
 *   ["2569","2568","2567","2566"]
 *
 * NOT part of the frozen contract — the Laravel system had no such route, and
 * nothing outside this app consumes it. It exists because the home page builds
 * its year picker in the browser (requirement: the landing page reads the ITA
 * list through the API, not through the server), and the alternative is what
 * the faculty website does today: probe /ita/{year} downwards until something
 * comes back, which is a request per empty year on every visit.
 *
 * Public, like /api/v1/ita/{year}: it says which years exist, and the years
 * themselves are already visible on the published pages.
 */

const CORS_ORIGIN = "*";

export async function GET(request: Request) {
  const rate = consumeRateLimit(clientKey(request));
  if (!rate.allowed && !sameOrigin(request)) return tooManyRequests(rate, CORS_ORIGIN);

  const years = await listItaYears();

  return new Response(JSON.stringify(years), {
    status: 200,
    headers: legacyHeaders(rate, CORS_ORIGIN),
  });
}

export function OPTIONS() {
  return new Response(null, {
    status: 204,
    headers: {
      "Access-Control-Allow-Origin": CORS_ORIGIN,
      "Access-Control-Allow-Methods": "GET",
      "Access-Control-Allow-Headers": "X-Requested-With, Content-Type, X-Token-Auth, Authorization",
    },
  });
}
