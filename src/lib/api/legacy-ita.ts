import { prisma } from "@/lib/prisma";
import { legacyTimestamp } from "@/lib/api/legacy-response";

// The one place that knows what an ITA looks like in the frozen Public API
// (docs/chapters/05-public-api.md). Both the plain endpoint (F27) and the
// NDJSON stream (F29) build their output here, because the streaming variant
// exists to change *how* the bytes arrive and nothing else — if the two ever
// disagreed about a field name, one of them would be silently wrong.

export type LegacyOit = {
  id: number;
  ita_id: string;
  title: string;
  link: string | null;
  content: string | null;
  created_at: string;
  updated_at: string;
};

export type LegacyIta = {
  id: number;
  title: string;
  year: string;
  order: string;
  created_at: string;
  updated_at: string;
  oits: LegacyOit[];
};

/** Columns the response needs. `user_id` is NOT among them — see the chapter. */
export const ITA_SELECT = {
  id: true,
  title: true,
  year: true,
  order: true,
  createdAt: true,
  updatedAt: true,
} as const;

export const OIT_SELECT = {
  id: true,
  itaId: true,
  title: true,
  link: true,
  content: true,
  createdAt: true,
  updatedAt: true,
} as const;

type ItaRow = {
  id: number;
  title: string;
  year: string;
  order: number;
  createdAt: Date;
  updatedAt: Date;
};

type OitRow = {
  id: number;
  itaId: number;
  title: string;
  link: string | null;
  content: string | null;
  createdAt: Date;
  updatedAt: Date;
};

/**
 * Eloquent + the legacy MySQL column types produced a response where `id` is a
 * number while `order` and `ita_id` are strings. It is inconsistent, and it is
 * the contract: mirror it rather than tidy it.
 */
export function toLegacyIta(ita: ItaRow, oits: OitRow[]): LegacyIta {
  return {
    id: ita.id,
    title: ita.title,
    year: ita.year,
    order: String(ita.order),
    created_at: legacyTimestamp(ita.createdAt),
    updated_at: legacyTimestamp(ita.updatedAt),
    oits: oits.map((oit) => ({
      id: oit.id,
      ita_id: String(oit.itaId),
      title: oit.title,
      link: oit.link,
      content: oit.content,
      created_at: legacyTimestamp(oit.createdAt),
      updated_at: legacyTimestamp(oit.updatedAt),
    })),
  };
}

/**
 * The year's rows as the contract returns them — eager-loaded, both levels
 * ordered explicitly (PostgreSQL promises no row order without ORDER BY, and
 * the faculty page renders OITs in the order it receives them).
 *
 * The one query behind the plain endpoint AND the stream's JSON fallback. It
 * lives here, next to `toLegacyIta()`, so a change to what the frozen contract
 * returns happens in exactly one place.
 */
export async function loadLegacyYear(year: string): Promise<LegacyIta[]> {
  const rows = await prisma.ita.findMany({
    where: { year },
    orderBy: { order: "asc" },
    select: { ...ITA_SELECT, oits: { orderBy: { id: "asc" }, select: OIT_SELECT } },
  });

  return rows.map(({ oits, ...ita }) => toLegacyIta(ita, oits));
}
