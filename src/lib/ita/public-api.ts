import { withBasePath } from "@/lib/base-path";

// The home page reads its ITA list from the Public API in the browser, not from
// the server (stakeholder requirement). This module is the seam between the
// frozen snake_case contract and the shape the accordion renders — so the
// render shape is defined here, and the component imports it, not the other
// way round.
//
// Client-safe on purpose: no Prisma, no node: imports.

/**
 * One OIT as the accordion renders it. `contentHtml` is `fetchItasByYear`'s
 * sanitised output — never the raw `content` from the wire.
 */
export type AccordionOit = {
  id: number;
  title: string;
  link: string | null;
  /** Null when the OIT has no content. */
  contentHtml: string | null;
  /** ISO string — it crossed HTTP as the contract's `updated_at` field. */
  updatedAt: string;
};

export type ItaAccordionEntry = {
  id: number;
  title: string;
  year: string;
  order: number;
  oits: AccordionOit[];
};

/** One ITA topic exactly as `/api/v1/ita/{year}` returns it (F27, frozen). */
type ApiIta = {
  id: number;
  title: string;
  year: string;
  /** string in the contract, not a number */
  order: string;
  oits: {
    id: number;
    title: string;
    link: string | null;
    content: string | null;
    updated_at: string;
  }[];
};

export class PublicApiError extends Error {}

async function getJson<T>(path: string, signal: AbortSignal): Promise<T> {
  // fetch() does NOT get the basePath added for it — see AGENTS.md.
  const response = await fetch(withBasePath(path), {
    headers: { Accept: "application/json" },
    signal,
  });
  if (!response.ok) throw new PublicApiError(`HTTP ${response.status}`);

  const data = await response.json();
  // The contract promises an array at the top level; anything else means we are
  // talking to something that is not this API (a proxy error page, say).
  if (!Array.isArray(data)) throw new PublicApiError("รูปแบบข้อมูลไม่ถูกต้อง");
  return data as T;
}

/** Years that have at least one topic, newest first. */
export function fetchItaYears(signal: AbortSignal): Promise<string[]> {
  return getJson<string[]>("/api/v1/ita-years", signal);
}

/**
 * One year's topics, converted to what the accordion expects.
 *
 * `content` is sanitised here, in the browser, before it can reach
 * `dangerouslySetInnerHTML`. It was already sanitised when it was saved (F16)
 * and again by the migration (F32), so this is the third pass — and the only
 * one that sees the HTML in the form the reader will actually get, now that it
 * arrives over HTTP instead of straight from the database.
 */
export async function fetchItasByYear(
  year: string,
  signal: AbortSignal,
): Promise<ItaAccordionEntry[]> {
  const { sanitizeHtml } = await import("@/lib/sanitize");
  const rows = await getJson<ApiIta[]>(`/api/v1/ita/${year}`, signal);

  return rows.map((ita) => ({
    id: ita.id,
    title: ita.title,
    year: ita.year,
    order: Number(ita.order),
    oits: ita.oits.map((oit) => ({
      id: oit.id,
      title: oit.title,
      link: oit.link,
      contentHtml: oit.content ? sanitizeHtml(oit.content) || null : null,
      updatedAt: oit.updated_at,
    })),
  }));
}
