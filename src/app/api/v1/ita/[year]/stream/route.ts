import { z } from "zod";
import { ITA_SELECT, OIT_SELECT, toLegacyIta } from "@/lib/api/legacy-ita";
import { legacyHeaders, tooManyRequests } from "@/lib/api/legacy-response";
import { clientKey, consumeRateLimit, sameOrigin } from "@/lib/api/rate-limit";
import { prisma } from "@/lib/prisma";

/**
 * GET /api/v1/ita/{year}/stream  (real path: /fonita/api/v1/ita/{year}/stream)
 *
 * The same data as /api/v1/ita/{year}, sent one topic at a time as NDJSON —
 * F29, designed in docs/features/api-streaming.md.
 *
 * **Streaming changes how the bytes arrive, never what they say.** Every line
 * is built by `toLegacyIta()`, the same function the plain endpoint uses, so
 * the two cannot drift apart: `order` and `ita_id` stay strings, timestamps
 * keep their six decimals, `user_id` stays absent.
 *
 * Separate path rather than content negotiation on the frozen one: nothing that
 * consumes /api/v1/ita/{year} today should be able to receive a different
 * transfer encoding because of a header it did not think about.
 */

const yearSchema = z.string().regex(/^\d{4}$/);

const CORS_ORIGIN = "*";
const NDJSON = "application/x-ndjson";

export async function GET(
  request: Request,
  { params }: { params: Promise<{ year: string }> },
) {
  const rate = consumeRateLimit(clientKey(request));
  if (!rate.allowed && !sameOrigin(request)) return tooManyRequests(rate, CORS_ORIGIN);

  const { year: raw } = await params;
  const parsed = yearSchema.safeParse(raw);
  const year = parsed.success ? parsed.data : null;

  // "ถ้า client ไม่ส่ง Accept: application/x-ndjson → fall back ไปใช้ endpoint ปกติ"
  // (api-streaming.md §4.5). Answered here rather than redirected: a redirect
  // costs a round trip and drops the Accept header on some clients.
  if (!(request.headers.get("accept") ?? "").includes(NDJSON)) {
    const rows = year ? await loadYear(year) : [];
    return new Response(JSON.stringify(rows), {
      status: 200,
      headers: legacyHeaders(rate, CORS_ORIGIN),
    });
  }

  const encoder = new TextEncoder();
  const stream = new ReadableStream<Uint8Array>({
    async start(controller) {
      try {
        // Unknown year streams zero lines and closes — the empty-array case of
        // the plain endpoint, which must never be an error (F27).
        if (year) {
          // Topics first, then each topic's OITs as its line is written. The
          // point of this endpoint is time-to-first-byte: loading every OIT in
          // the year up front would make the first line wait for the last row.
          // A year holds a dozen topics, so the extra queries are cheap.
          const itas = await prisma.ita.findMany({
            where: { year },
            orderBy: { order: "asc" },
            select: ITA_SELECT,
          });

          for (const ita of itas) {
            // The reader closed the tab — stop querying for data nobody wants.
            if (request.signal.aborted) break;

            const oits = await prisma.oit.findMany({
              where: { itaId: ita.id },
              orderBy: { id: "asc" },
              select: OIT_SELECT,
            });

            controller.enqueue(
              encoder.encode(`${JSON.stringify(toLegacyIta(ita, oits))}\n`),
            );
          }
        }
      } catch (error) {
        // The status line and headers are long gone, so there is no way to turn
        // this into a 500. The stream ends short; the server log is the only
        // place the reason can be recorded.
        console.error("[ita-stream] failed mid-stream", error);
      } finally {
        controller.close();
      }
    },
  });

  const headers = legacyHeaders(rate, CORS_ORIGIN);
  headers.set("Content-Type", `${NDJSON}; charset=utf-8`);
  // Chunks must reach the reader as they are produced; a proxy that buffers the
  // response would undo the whole endpoint.
  headers.set("X-Accel-Buffering", "no");

  return new Response(stream, { status: 200, headers });
}

async function loadYear(year: string) {
  const rows = await prisma.ita.findMany({
    where: { year },
    orderBy: { order: "asc" },
    select: { ...ITA_SELECT, oits: { orderBy: { id: "asc" }, select: OIT_SELECT } },
  });
  return rows.map(({ oits, ...ita }) => toLegacyIta(ita, oits));
}

export function OPTIONS() {
  return new Response(null, {
    status: 204,
    headers: {
      "Access-Control-Allow-Origin": CORS_ORIGIN,
      "Access-Control-Allow-Methods": "GET",
      "Access-Control-Allow-Headers": "X-Requested-With, Content-Type, X-Token-Auth, Authorization, Accept",
    },
  });
}
