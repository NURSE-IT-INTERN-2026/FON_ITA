import { prisma } from "@/lib/prisma";
import { sanitizeHtml } from "@/lib/sanitize";

// Read side of the ITA list (F13). `year` is a 4-digit พ.ศ. string in the
// database — the frozen Public API returns it as a string, so it is stored that
// way rather than converted back and forth.

export type ItaWithOits = {
  id: number;
  title: string;
  year: string;
  order: number;
  oits: { id: number; title: string; link: string | null; updatedAt: Date }[];
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

/**
 * Same rows as `getItasByYear`, plus each OIT's content — for the public
 * landing page, which opens the content in a modal instead of navigating.
 *
 * Kept as a separate function rather than a flag on the one above: the content
 * of every OIT in a year is a few dozen KB, it crosses to a Client Component,
 * and /ita-list has no use for it. Only the page that renders it pays for it.
 *
 * Sanitised here, on the server. Rendering it means `dangerouslySetInnerHTML`,
 * and the alternative — cleaning it in the browser — would ship DOMPurify to
 * every visitor to redo work the server can do once (decisions.md D3).
 */
export async function getPublicItasByYear(year: string): Promise<PublicIta[]> {
  const rows = await prisma.ita.findMany({
    where: { year },
    orderBy: { order: "asc" },
    select: {
      id: true,
      title: true,
      year: true,
      order: true,
      oits: {
        orderBy: { id: "asc" },
        select: { id: true, title: true, link: true, content: true, updatedAt: true },
      },
    },
  });

  return rows.map((ita) => ({
    ...ita,
    oits: ita.oits.map(({ content, ...oit }) => ({
      ...oit,
      // An "empty" editor document is stored as null (F16), but a row written
      // before that rule, or one whose tags are all stripped, can still clean
      // down to nothing — so the emptiness test happens after sanitising.
      contentHtml: content ? sanitizeHtml(content) || null : null,
    })),
  }));
}

export type PublicIta = ItaWithOits & {
  oits: (ItaWithOits["oits"][number] & { contentHtml: string | null })[];
};

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
        select: { id: true, title: true, link: true, updatedAt: true },
      },
    },
  });
}
