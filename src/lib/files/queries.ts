import { prisma } from "@/lib/prisma";

// Read side of the central file library (F18).

/** Rows per page — the Laravel system used 15 and staff are used to it. */
export const FILES_PER_PAGE = 15;

export type FileRow = {
  id: number;
  name: string;
  path: string;
  /** uploader — decides who sees the delete button (D5) */
  userId: number;
  createdBy: string;
  createdAt: Date;
};

export type FilePage = {
  files: FileRow[];
  page: number;
  totalPages: number;
  total: number;
};

/**
 * Escape the LIKE wildcards in a search term.
 *
 * Prisma's `contains` builds an ILIKE pattern and passes the term through as-is
 * — verified: searching for "%" returned every row, and "_" matched any single
 * character. That is not an injection (the value is still parameterised), but it
 * makes a literal "ITA-100%" unsearchable. PostgreSQL's default escape
 * character is a backslash, which must itself be escaped first.
 */
function escapeLike(term: string): string {
  return term.replace(/\\/g, "\\\\").replace(/%/g, "\\%").replace(/_/g, "\\_");
}

/** Case-insensitive "contains" filter on the display name (F21). */
function nameFilter(search?: string) {
  const term = search?.trim();
  return term ? { name: { contains: escapeLike(term), mode: "insensitive" as const } } : {};
}

/**
 * One page of files, newest first, optionally filtered by name.
 *
 * `page` is clamped rather than trusted: it arrives from the query string, and
 * a huge value would otherwise return an empty table with no way back.
 */
export async function listFiles(page: number, search?: string): Promise<FilePage> {
  const where = nameFilter(search);
  const total = await prisma.itaFile.count({ where });
  const totalPages = Math.max(1, Math.ceil(total / FILES_PER_PAGE));
  const current = Math.min(Math.max(1, page), totalPages);

  const files = await prisma.itaFile.findMany({
    where,
    orderBy: { createdAt: "desc" },
    skip: (current - 1) * FILES_PER_PAGE,
    take: FILES_PER_PAGE,
    select: {
      id: true,
      name: true,
      path: true,
      userId: true,
      createdBy: true,
      createdAt: true,
    },
  });

  return { files, page: current, totalPages, total };
}

/** How many matches the OIT file picker shows before asking for a narrower term. */
export const PICKER_LIMIT = 8;

/** Name search for the picker in the OIT editor (F21). */
export async function searchFilesByName(search: string) {
  return prisma.itaFile.findMany({
    where: nameFilter(search),
    orderBy: { createdAt: "desc" },
    take: PICKER_LIMIT,
    select: { id: true, name: true, path: true },
  });
}

export type PickerFile = Awaited<ReturnType<typeof searchFilesByName>>[number];
