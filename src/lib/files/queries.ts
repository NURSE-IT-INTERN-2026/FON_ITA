import { prisma } from "@/lib/prisma";

// Read side of the central file library (F18).

/** Rows per page — the Laravel system used 15 and staff are used to it. */
export const FILES_PER_PAGE = 15;

export type FileRow = {
  id: number;
  name: string;
  path: string;
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
 * One page of files, newest first.
 *
 * `page` is clamped rather than trusted: it arrives from the query string, and
 * a huge value would otherwise return an empty table with no way back.
 */
export async function listFiles(page: number): Promise<FilePage> {
  const total = await prisma.itaFile.count();
  const totalPages = Math.max(1, Math.ceil(total / FILES_PER_PAGE));
  const current = Math.min(Math.max(1, page), totalPages);

  const files = await prisma.itaFile.findMany({
    orderBy: { createdAt: "desc" },
    skip: (current - 1) * FILES_PER_PAGE,
    take: FILES_PER_PAGE,
    select: { id: true, name: true, path: true, createdBy: true, createdAt: true },
  });

  return { files, page: current, totalPages, total };
}
