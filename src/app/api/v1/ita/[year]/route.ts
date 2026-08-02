import { z } from "zod";
import { legacyHeaders, legacyTimestamp, tooManyRequests } from "@/lib/api/legacy-response";
import { clientKey, consumeRateLimit } from "@/lib/api/rate-limit";
import { prisma } from "@/lib/prisma";

/**
 * GET /api/v1/ita/{year}  (real path: /fonita/api/v1/ita/{year})
 *
 * FROZEN contract — see docs/chapters/05-public-api.md. The faculty website
 * consumes this response as it stands today; field names, JSON types and the
 * top-level array are all part of the promise, not implementation detail.
 *
 * Public by design: no session, no role check. It publishes exactly what the
 * ITA pages already publish (decisions.md D12).
 */

// The only consumer sends a 4-digit พ.ศ. year. Anything else is answered the way
// the old system answers it — an empty array, never an error. Verified against
// the live system: /ita/abc and /ita/99999 both return [] with HTTP 200.
const yearSchema = z.string().regex(/^\d{4}$/);

const CORS_ORIGIN = "*";

type LegacyOit = {
  id: number;
  ita_id: string;
  title: string;
  link: string | null;
  content: string | null;
  created_at: string;
  updated_at: string;
};

type LegacyIta = {
  id: number;
  title: string;
  year: string;
  order: string;
  created_at: string;
  updated_at: string;
  oits: LegacyOit[];
};

export async function GET(
  request: Request,
  { params }: { params: Promise<{ year: string }> },
) {
  const rate = consumeRateLimit(clientKey(request));
  if (!rate.allowed) return tooManyRequests(rate, CORS_ORIGIN);

  const { year: raw } = await params;
  const parsed = yearSchema.safeParse(raw);

  // An unparseable year still gets a 200 and an empty array. The faculty page
  // walks years backwards with findLatestAvailableYear() and treats any
  // non-array as a hard failure — a 404 here would break the whole page.
  const payload: LegacyIta[] = parsed.success ? await loadYear(parsed.data) : [];

  return new Response(JSON.stringify(payload), {
    status: 200,
    headers: legacyHeaders(rate, CORS_ORIGIN),
  });
}

async function loadYear(year: string): Promise<LegacyIta[]> {
  const rows = await prisma.ita.findMany({
    where: { year },
    // Both levels are ordered explicitly. PostgreSQL gives no row order without
    // ORDER BY — an UPDATE alone is enough to move a row — and the faculty page
    // renders the OITs in the order it receives them, as O1…O26. MySQL used to
    // return PK order by accident; relying on that here would scramble the
    // published page.
    orderBy: { order: "asc" },
    select: {
      id: true,
      title: true,
      year: true,
      order: true,
      createdAt: true,
      updatedAt: true,
      oits: {
        orderBy: { id: "asc" },
        select: {
          id: true,
          itaId: true,
          title: true,
          link: true,
          content: true,
          createdAt: true,
          updatedAt: true,
        },
      },
    },
  });

  // Eloquent + the legacy MySQL column types produced a response where `id` is a
  // number but `order` and `ita_id` are strings. It is inconsistent, and it is
  // the contract: mirror it rather than tidy it.
  //
  // `user_id` is NOT in the legacy response for either level — do not add it.
  return rows.map((ita) => ({
    id: ita.id,
    title: ita.title,
    year: ita.year,
    order: String(ita.order),
    created_at: legacyTimestamp(ita.createdAt),
    updated_at: legacyTimestamp(ita.updatedAt),
    oits: ita.oits.map((oit) => ({
      id: oit.id,
      ita_id: String(oit.itaId),
      title: oit.title,
      link: oit.link,
      content: oit.content,
      created_at: legacyTimestamp(oit.createdAt),
      updated_at: legacyTimestamp(oit.updatedAt),
    })),
  }));
}

/**
 * The consumer's request is a simple GET, so no browser sends a preflight —
 * this is here for any other client that does, and for parity with the old
 * `api` middleware group, which answered OPTIONS.
 */
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
