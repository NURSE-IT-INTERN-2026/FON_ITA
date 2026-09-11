import { escapeLike, prisma } from "@/lib/prisma";

// Read side of the central file library (F18).

/** Rows per page — the Laravel system used 15 and staff are used to it. */
export const FILES_PER_PAGE = 15;

export type FileRow = {
  id: number;
  name: string;
  path: string;
  /** uploader — decides who sees the delete button (D5). Null once the
      uploader's account has been deleted (D26); the display name survives in
      `createdBy`. */
  userId: number | null;
  createdBy: string;
  createdAt: Date;
};

export type FilePage = {
  files: FileRow[];
  page: number;
  totalPages: number;
  total: number;
};

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

/** Rows per page in the OIT file picker — same 15 as every other list in the
    app (FILES_PER_PAGE, USERS_PER_PAGE) so the pager feels uniform. */
export const PICKER_LIMIT = 15;

export type PickerResult = {
  files: PickerFile[];
  /** Matches in total, not just the ones returned. */
  total: number;
  page: number;
  totalPages: number;
};

/**
 * Paged name search for the picker in the OIT editor (F21).
 *
 * `page` is clamped the same way as listFiles — it arrives from the dialog, and
 * an out-of-range value would otherwise show an empty list with no way back.
 */
export async function searchFilesByName(search: string, page = 1): Promise<PickerResult> {
  const where = nameFilter(search);
  const total = await prisma.itaFile.count({ where });
  const totalPages = Math.max(1, Math.ceil(total / PICKER_LIMIT));
  const current = Math.min(Math.max(1, page), totalPages);

  const files = await prisma.itaFile.findMany({
    where,
    // Same tie problem as listFiles: without this, *which* rows of a tied
    // group the picker shows could change between two identical searches.
    orderBy: [{ createdAt: "desc" }, { id: "desc" }],
    skip: (current - 1) * PICKER_LIMIT,
    take: PICKER_LIMIT,
    select: { id: true, name: true, path: true, createdBy: true, createdAt: true },
  });

  return { files, total, page: current, totalPages };
}

export type PickerFile = {
  id: number;
  name: string;
  path: string;
  createdBy: string;
  createdAt: Date;
};

export type OitFileReference = {
  id: number;
  title: string;
  itaTitle: string;
  itaYear: string;
};

/**
 * Which OIT entries link to this file (F20 delete warning). Both `content`
 * (rich-text href) and `link` (pasted via "คัดลอกลิงก์") store the full
 * `fileUrl()` output — `withBasePath("/storage/itafile/" + encodeURIComponent(path))`
 * — so the needle has to be encoded and escaped the same way that value was
 * built, not the raw `path` column: a legacy name with Thai text or spaces
 * never appears un-encoded in either field, and an unescaped `_`/`%` in a
 * stored name would match more rows than actually reference it.
 * Newest year first — the order staff meet these entries in on the site.
 */
export async function listOitFileReferences(path: string): Promise<OitFileReference[]> {
  const needle = escapeLike(`/storage/itafile/${encodeURIComponent(path)}`);
  const rows = await prisma.oit.findMany({
    where: { OR: [{ content: { contains: needle } }, { link: { contains: needle } }] },
    orderBy: [{ ita: { year: "desc" } }, { id: "asc" }],
    select: { id: true, title: true, ita: { select: { title: true, year: true } } },
  });
  return rows.map(({ id, title, ita }) => ({
    id,
    title,
    itaTitle: ita.title,
    itaYear: ita.year,
  }));
}
