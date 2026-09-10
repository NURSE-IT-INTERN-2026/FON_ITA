"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { logActivity } from "@/lib/activity/log";
import { FORBIDDEN_MESSAGE } from "@/lib/auth/errors";
import { getActorIfRole } from "@/lib/auth/guards";
import {
  countOitFileReferences,
  type PickerFile,
  type PickerResult,
  searchFilesByName,
} from "@/lib/files/queries";
import { checkUpload, deleteUpload, saveUpload } from "@/lib/files/storage";
import { prisma } from "@/lib/prisma";

// Write side of the file library (F19). ADMIN+ only — visitors have no account
// and USER accounts no longer exist (decisions.md D12).

export type FileActionState = { error?: string; file?: PickerFile };

const UPLOAD_FAILED = "อัปโหลดไม่สำเร็จ โปรดลองอีกครั้ง";
const DELETE_FAILED = "ลบไม่สำเร็จ โปรดลองอีกครั้ง";

const deleteSchema = z.object({ id: z.coerce.number().int().positive() });

const uploadSchema = z.object({
  // The display name in the library, not the filename on disk. Unique so staff
  // searching in the OIT form (F21) get one obvious hit.
  name: z
    .string()
    .trim()
    .min(1, { message: "กรุณากรอกชื่อไฟล์" })
    .max(255, { message: "ชื่อไฟล์ต้องไม่เกิน 255 ตัวอักษร" }),
});

export async function uploadFile(formData: FormData): Promise<FileActionState> {
  const user = await getActorIfRole("ADMIN", "SUPERADMIN");
  if (!user) return { error: FORBIDDEN_MESSAGE };

  const parsed = uploadSchema.safeParse({ name: formData.get("name") });
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "ข้อมูลไม่ถูกต้อง" };
  const { name } = parsed.data;

  const file = formData.get("file");
  if (!(file instanceof File)) return { error: "กรุณาเลือกไฟล์" };

  // Size and type are checked before anything is written to disk.
  const check = checkUpload(file);
  if ("error" in check) return { error: check.error };

  try {
    // Friendly message for the common case; the unique index below is what
    // actually guarantees it when two people upload at once.
    const clash = await prisma.itaFile.findUnique({ where: { name } });
    if (clash) return { error: "มีไฟล์ชื่อนี้อยู่แล้ว โปรดตั้งชื่ออื่น" };

    const storedName = await saveUpload(file, check.ext);

    try {
      const created = await prisma.itaFile.create({
        data: {
          userId: user.id,
          // Denormalised in the legacy schema so the uploader's name survives even
          // if the account is later removed.
          createdBy: `${user.prefix ?? ""}${user.firstname} ${user.lastname}`.trim(),
          name,
          path: storedName,
        },
        select: { id: true, name: true, path: true, createdBy: true, createdAt: true },
      });

      await logActivity(user, "file.upload", {
        target: name,
        detail: `ไฟล์บนดิสก์: ${storedName}`,
      });

      revalidatePath("/ita-file");
      // Return the new row so callers (the OIT editor drag-drop, the inline picker
      // upload) can insert a link to it without re-running a search to find it.
      return { file: created };
    } catch (error) {
      // The row is what makes a file reachable — without it the bytes on disk are
      // an orphan nobody can see or delete. Undo the write.
      await deleteUpload(storedName);

      if (error instanceof Error && "code" in error && error.code === "P2002") {
        return { error: "มีไฟล์ชื่อนี้อยู่แล้ว โปรดตั้งชื่ออื่น" };
      }
      throw error;
    }
  } catch (error) {
    // Reaching here means the lookup or the disk write itself failed — either
    // way the dialog stays open with what was typed, instead of the whole page
    // being replaced by Next's error boundary.
    console.error("[file] uploadFile failed", error);
    return { error: UPLOAD_FAILED };
  }
}

/**
 * Paged name search for the file picker in the OIT editor (F21).
 *
 * ADMIN+ like the rest of the library: it is a browsing surface over the same
 * data, and only editors can reach the editor it lives in. Returns an empty
 * list rather than an error, so the picker has nothing to leak.
 */
export async function searchFiles(term: string, page = 1): Promise<PickerResult> {
  const user = await getActorIfRole("ADMIN", "SUPERADMIN");
  if (!user) return { files: [], total: 0, page: 1, totalPages: 1 };

  const parsed = z
    .object({ term: z.string().max(255), page: z.coerce.number().int().min(1).max(10_000) })
    .safeParse({ term, page });
  if (!parsed.success) return { files: [], total: 0, page: 1, totalPages: 1 };

  try {
    return await searchFilesByName(parsed.data.term, parsed.data.page);
  } catch (error) {
    // The picker opens mid-edit inside the OIT form — an error here must not
    // take the surrounding form down with it. An empty result degrades the
    // picker alone.
    console.error("[file] searchFiles failed", error);
    return { files: [], total: 0, page: 1, totalPages: 1 };
  }
}

/**
 * Delete a file — its own uploader, or a SUPERADMIN for any file (D5).
 *
 * SUPERADMIN's reach is deliberate: when a staff member leaves, their uploads
 * would otherwise be undeletable by anyone.
 */
export async function deleteFile(formData: FormData): Promise<FileActionState> {
  const user = await getActorIfRole("ADMIN", "SUPERADMIN");
  if (!user) return { error: FORBIDDEN_MESSAGE };

  const parsed = deleteSchema.safeParse({ id: formData.get("id") });
  if (!parsed.success) return { error: "คำขอไม่ถูกต้อง" };

  try {
    const file = await prisma.itaFile.findUnique({ where: { id: parsed.data.id } });
    if (!file) return { error: "ไม่พบไฟล์ที่ต้องการลบ" };

    // Ownership is decided here, not from anything the client sent: the UI hides
    // the button, but the action is a separate door.
    if (file.userId !== user.id && user.role !== "SUPERADMIN") {
      return { error: "ลบได้เฉพาะไฟล์ที่ตนเองอัปโหลด" };
    }

    // Row first, then the bytes. If the unlink fails afterwards the file is
    // merely orphaned on disk — unreachable, because nothing serves a file
    // without its row. The other order would leave a row pointing at a file that
    // is no longer there, which users would meet as a broken download.
    await prisma.itaFile.delete({ where: { id: file.id } });
    await deleteUpload(file.path);

    await logActivity(user, "file.delete", {
      target: file.name,
      // Worth recording when a SUPERADMIN removes someone else's upload — that is
      // the case anyone reading the log later will want explained.
      detail:
        file.userId === user.id ? `ลบไฟล์บนดิสก์: ${file.path}` : `อัปโหลดโดย ${file.createdBy}`,
    });

    revalidatePath("/ita-file");
    return {};
  } catch (error) {
    console.error("[file] deleteFile failed", error);
    return { error: DELETE_FAILED };
  }
}

/**
 * Reference count for the delete confirm dialog (F20). ADMIN+ like the rest of
 * the library. Returns 0 for a missing id or a rejected caller — the dialog
 * treats "unknown" as "no references", and the delete itself re-checks
 * everything that actually matters.
 */
export async function fileReferenceCount(fileId: number): Promise<number> {
  const user = await getActorIfRole("ADMIN", "SUPERADMIN");
  if (!user) return 0;

  const parsed = z.coerce.number().int().positive().safeParse(fileId);
  if (!parsed.success) return 0;

  const file = await prisma.itaFile.findUnique({
    where: { id: parsed.data },
    select: { path: true },
  });
  if (!file) return 0;
  return countOitFileReferences(file.path);
}
