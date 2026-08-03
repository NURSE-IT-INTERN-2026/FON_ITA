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
    // `id` breaks ties, and it is not optional here: the migration (F32) dated
    // each file from the OIT that first referenced it, so 116 rows share only 49
    // distinct timestamps — one group is 9 rows wide, wider than half a page.
    // Without a tiebreaker PostgreSQL may return tied rows in any order, and a
    // group straddling a page boundary would show a file twice or skip it
    // entirely. Verified: touching one row reorders its group.
    orderBy: [{ createdAt: "desc" }, { id: "desc" }],
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

export type PickerResult = {
  files: PickerFile[];
  /** Matches in total, not just the ones returned. */
  total: number;
};

/**
 * Name search for the picker in the OIT editor (F21).
 *
 * Returns the total alongside the capped list. Without it the picker cannot say
 * that it is showing a slice: a search for "การ" matches 75 of the 116 migrated
 * files, and eight results with no further explanation read as "that is all
 * there is" — which ends with someone uploading a copy of a file already in the
 * library.
 */
export async function searchFilesByName(search: string): Promise<PickerResult> {
  const where = nameFilter(search);

  const [files, total] = await Promise.all([
    prisma.itaFile.findMany({
      where,
      // Same tie problem as listFiles: without this, *which* 8 of a tied group
      // the picker shows could change between two identical searches.
      orderBy: [{ createdAt: "desc" }, { id: "desc" }],
      take: PICKER_LIMIT,
      select: { id: true, name: true, path: true, createdBy: true, createdAt: true },
    }),
    prisma.itaFile.count({ where }),
  ]);

  return { files, total };
}

export type PickerFile = {
  id: number;
  name: string;
  path: string;
  createdBy: string;
  createdAt: Date;
};
