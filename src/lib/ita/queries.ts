import { prisma } from "@/lib/prisma";

// Read side of the ITA list (F13). `year` is a 4-digit พ.ศ. string in the
// database — the frozen Public API returns it as a string, so it is stored that
// way rather than converted back and forth.

export type ItaWithOits = {
  id: number;
  title: string;
  year: string;
  order: number;
  oits: { id: number; title: string; link: string | null }[];
};

/** Every year that has at least one ITA, newest first — feeds the year picker. */
export async function listItaYears(): Promise<string[]> {
  const rows = await prisma.ita.findMany({
    distinct: ["year"],
    select: { year: true },
    orderBy: { year: "desc" },
  });
  return rows.map((r) => r.year);
}

/**
 * Year options for the picker, newest first.
 *
 * `ensure` adds years that have no rows yet but must still be selectable — the
 * year being viewed, and the current พ.ศ. year. Without it, the current year
 * disappears from the list until someone files its first topic, leaving no way
 * to navigate to it. Four-digit strings sort correctly as text.
 */
export function yearOptions(years: string[], ...ensure: string[]): string[] {
  return [...new Set([...years, ...ensure])].sort((a, b) => b.localeCompare(a));
}

/**
 * ITA topics for one year, each with its OIT children.
 *
 * Both levels are ordered explicitly. PostgreSQL makes no promise about row
 * order without ORDER BY — least of all after an UPDATE moves a row — and the
 * faculty website shows O1…O26 in sequence, so leaving it out would scramble
 * the public page (see F27).
 */
/** One ITA topic — the parent shown read-only on the OIT create form (F15). */
export async function getIta(id: number) {
  return prisma.ita.findUnique({
    where: { id },
    select: { id: true, title: true, year: true },
  });
}

/** One OIT with its parent, for the detail and edit pages (F15). */
export async function getOit(id: number) {
  return prisma.oit.findUnique({
    where: { id },
    select: {
      id: true,
      title: true,
      link: true,
      content: true,
      updatedAt: true,
      ita: { select: { id: true, title: true, year: true } },
    },
  });
}

export type OitDetail = NonNullable<Awaited<ReturnType<typeof getOit>>>;

export async function getItasByYear(year: string): Promise<ItaWithOits[]> {
  return prisma.ita.findMany({
    where: { year },
    orderBy: { order: "asc" },
    select: {
      id: true,
      title: true,
      year: true,
      order: true,
      oits: {
        orderBy: { id: "asc" },
        select: { id: true, title: true, link: true },
      },
    },
  });
}
