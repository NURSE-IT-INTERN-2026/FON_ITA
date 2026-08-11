import { randomBytes } from "node:crypto";
import { mkdir, unlink, writeFile } from "node:fs/promises";
import path from "node:path";

// Where uploads live on disk, and the rules for what may be written (F19).
//
// Files are stored OUTSIDE public/ on purpose: anything under public/ is served
// by Next.js directly, with no chance to check anything first. They are handed
// out by the route handler in F22 instead.

const UPLOAD_DIR = process.env.UPLOAD_DIR ?? "storage/uploads/itafile";

export const MAX_FILE_SIZE_BYTES = Number(process.env.MAX_FILE_SIZE_BYTES ?? 10 * 1024 * 1024);

/**
 * Accepted extensions and the MIME types that may accompany them.
 *
 * The MIME lists live in code, not in env: `ALLOWED_FILE_TYPES` can only name
 * extensions, and an extension alone is just the end of a string the user chose.
 */
const MIME_BY_EXTENSION: Record<string, string[]> = {
  png: ["image/png"],
  jpg: ["image/jpeg"],
  jpeg: ["image/jpeg"],
  webp: ["image/webp"],
  pdf: ["application/pdf"],
  xlsx: ["application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"],
  docx: ["application/vnd.openxmlformats-officedocument.wordprocessingml.document"],
};

/**
 * Content-Type to send when serving a stored file (F22).
 *
 * Taken from the extension of the name WE generated, never from anything the
 * client sends — and unknown extensions fall back to octet-stream so a file
 * that somehow slipped in cannot be rendered as HTML.
 */
export function contentTypeFor(storedName: string): string {
  const ext = path.extname(storedName).replace(".", "").toLowerCase();
  return MIME_BY_EXTENSION[ext]?.[0] ?? "application/octet-stream";
}

/** Whether a browser can display this type, rather than having to download it. */
export function isInlineType(storedName: string): boolean {
  const ext = path.extname(storedName).replace(".", "").toLowerCase();
  return ["pdf", "png", "jpg", "jpeg", "webp"].includes(ext);
}

/** Extensions actually enabled for this deployment. */
export function allowedExtensions(): string[] {
  const configured = (process.env.ALLOWED_FILE_TYPES ?? "png,jpg,jpeg,webp,pdf,xlsx,docx")
    .split(",")
    .map((e) => e.trim().toLowerCase())
    .filter(Boolean);

  // An extension with no MIME entry cannot be checked properly, so it is not
  // enabled by a typo in env.
  return configured.filter((ext) => ext in MIME_BY_EXTENSION);
}

/**
 * Absolute path of the upload directory.
 *
 * Throws if it resolves inside `public/`: that would quietly turn every upload
 * into a publicly served file and undo the reason for this module.
 */
export function uploadRoot(): string {
  const root = path.resolve(process.cwd(), UPLOAD_DIR);
  const publicDir = path.resolve(process.cwd(), "public");

  if (root === publicDir || root.startsWith(`${publicDir}${path.sep}`)) {
    throw new Error(`UPLOAD_DIR must not be inside public/ — got "${root}"`);
  }
  return root;
}

export type FileCheck = { ext: string } | { error: string };

/** Validate the upload before a single byte is written. */
export function checkUpload(file: File): FileCheck {
  if (!file || file.size === 0) return { error: "กรุณาเลือกไฟล์" };

  if (file.size > MAX_FILE_SIZE_BYTES) {
    const mb = Math.round(MAX_FILE_SIZE_BYTES / (1024 * 1024));
    return { error: `ไฟล์ต้องมีขนาดไม่เกิน ${mb} MB` };
  }

  const ext = path.extname(file.name).replace(".", "").toLowerCase();
  const allowed = allowedExtensions();

  if (!allowed.includes(ext)) {
    return { error: `รองรับเฉพาะไฟล์ ${allowed.join(", ")}` };
  }

  // The browser-supplied type is not trustworthy, but a mismatch is still a
  // clear signal. An empty type is accepted: some browsers send nothing at all
  // for xlsx, and rejecting that would block legitimate uploads.
  const mimes = MIME_BY_EXTENSION[ext];
  if (file.type && !mimes.includes(file.type)) {
    return { error: `ชนิดไฟล์ไม่ตรงกับนามสกุล .${ext}` };
  }

  return { ext };
}

/**
 * Write the file under a generated name and return that name.
 *
 * The stored name is a Unix timestamp (PRD FR-F6) — never the name the user
 * typed. That keeps every path-traversal trick, unicode trick and overwrite
 * attempt out of the filesystem entirely, since no part of the input reaches
 * the path. The random suffix only settles collisions within the same
 * millisecond.
 */
export async function saveUpload(file: File, ext: string): Promise<string> {
  const root = uploadRoot();
  await mkdir(root, { recursive: true });

  const storedName = `${Date.now()}-${randomBytes(3).toString("hex")}.${ext}`;
  const buffer = Buffer.from(await file.arrayBuffer());
  await writeFile(path.join(root, storedName), buffer, { flag: "wx" });

  return storedName;
}

/** Remove a stored file. Used to undo a write when the DB insert fails. */
export async function deleteUpload(storedName: string): Promise<void> {
  // `storedName` comes from our own column, but resolve and re-check anyway —
  // this function must never be able to reach outside the upload directory.
  const root = uploadRoot();
  const target = path.resolve(root, path.basename(storedName));
  if (!target.startsWith(`${root}${path.sep}`)) return;

  await unlink(target).catch(() => {
    // Already gone, or never written — nothing to undo.
  });
}
