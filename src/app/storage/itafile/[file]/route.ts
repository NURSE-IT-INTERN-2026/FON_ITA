import { createReadStream } from "node:fs";
import { stat } from "node:fs/promises";
import path from "node:path";
import { Readable } from "node:stream";
import { NextResponse } from "next/server";
import { contentTypeFor, isInlineType, uploadRoot } from "@/lib/files/storage";
import { prisma } from "@/lib/prisma";

/**
 * GET /storage/itafile/[file]  (real path: /fonita/storage/itafile/…)
 *
 * Serves an uploaded file (F22). Uploads live outside `public/` precisely so
 * that every read goes through this handler.
 *
 * Public on purpose: OIT content is public (decisions.md D12) and links to
 * these files, so requiring a session would break the published pages.
 */
export async function GET(
  _request: Request,
  { params }: { params: Promise<{ file: string }> },
) {
  const { file: raw } = await params;

  // Three separate guards, because this is the one place where a request names
  // a file on disk.
  //
  // 1. Strip any directory part. "../../.env" becomes ".env" here, so nothing
  //    below can be tricked by a crafted segment.
  const requested = path.basename(decodeURIComponent(raw));

  // 2. The name must be one we handed out. This is the real gate: an arbitrary
  //    filename cannot be read even if it exists in the directory.
  const record = await prisma.itaFile.findFirst({
    where: { path: requested },
    select: { name: true, path: true },
  });
  if (!record) return new NextResponse("ไม่พบไฟล์", { status: 404 });

  // 3. Resolve and confirm the result is still inside the upload directory —
  //    belt and braces if either check above is ever loosened.
  const root = uploadRoot();
  const absolute = path.resolve(root, record.path);
  if (!absolute.startsWith(`${root}${path.sep}`)) {
    return new NextResponse("ไม่พบไฟล์", { status: 404 });
  }

  const info = await stat(absolute).catch(() => null);
  if (!info?.isFile()) {
    // Row without bytes — the file was removed outside the app.
    console.error("[storage] row has no file on disk", record.path);
    return new NextResponse("ไม่พบไฟล์", { status: 404 });
  }

  // Streamed rather than buffered: up to 10MB per request would otherwise sit
  // in memory for every concurrent download.
  const body = Readable.toWeb(createReadStream(absolute)) as ReadableStream<Uint8Array>;

  const disposition = isInlineType(record.path) ? "inline" : "attachment";
  // The display name is Thai, so it goes in the RFC 5987 form; the plain
  // `filename` is a fallback for clients that ignore it.
  const encodedName = encodeURIComponent(`${record.name}${path.extname(record.path)}`);

  return new NextResponse(body, {
    headers: {
      "Content-Type": contentTypeFor(record.path),
      "Content-Length": String(info.size),
      "Content-Disposition": `${disposition}; filename*=UTF-8''${encodedName}`,
      // Stored names are unique per upload and never rewritten, so a cached copy
      // can never be stale. An hour, not a year, so that deleting a file that
      // should not have been published takes effect soon after.
      "Cache-Control": "public, max-age=3600",
      // The type is derived from our own whitelist, but this makes sure no
      // browser sniffs its way to treating a file as something else.
      "X-Content-Type-Options": "nosniff",
    },
  });
}
