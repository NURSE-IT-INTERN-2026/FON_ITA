"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { FORBIDDEN_MESSAGE } from "@/lib/auth/errors";
import { requireUser } from "@/lib/auth/guards";
import { hasRole } from "@/lib/auth/roles";
import { type PickerFile, searchFilesByName } from "@/lib/files/queries";
import { checkUpload, deleteUpload, saveUpload } from "@/lib/files/storage";
import { prisma } from "@/lib/prisma";

// Write side of the file library (F19). ADMIN+ only — visitors have no account
// and USER accounts no longer exist (decisions.md D12).

export type FileActionState = { error?: string };

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
  const user = await requireUser();
  if (!hasRole(user, "ADMIN", "SUPERADMIN")) return { error: FORBIDDEN_MESSAGE };

  const parsed = uploadSchema.safeParse({ name: formData.get("name") });
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "ข้อมูลไม่ถูกต้อง" };
  const { name } = parsed.data;

  const file = formData.get("file");
  if (!(file instanceof File)) return { error: "กรุณาเลือกไฟล์" };

  // Size and type are checked before anything is written to disk.
  const check = checkUpload(file);
  if ("error" in check) return { error: check.error };

  // Friendly message for the common case; the unique index below is what
  // actually guarantees it when two people upload at once.
  const clash = await prisma.itaFile.findUnique({ where: { name } });
  if (clash) return { error: "มีไฟล์ชื่อนี้อยู่แล้ว โปรดตั้งชื่ออื่น" };

  const storedName = await saveUpload(file, check.ext);

  try {
    await prisma.itaFile.create({
      data: {
        userId: user.id,
        // Denormalised in the legacy schema so the uploader's name survives even
        // if the account is later removed.
        createdBy: `${user.prefix ?? ""}${user.firstname} ${user.lastname}`.trim(),
        name,
        path: storedName,
      },
    });
  } catch (error) {
    // The row is what makes a file reachable — without it the bytes on disk are
    // an orphan nobody can see or delete. Undo the write.
    await deleteUpload(storedName);

    if (error instanceof Error && "code" in error && error.code === "P2002") {
      return { error: "มีไฟล์ชื่อนี้อยู่แล้ว โปรดตั้งชื่ออื่น" };
    }
    throw error;
  }

  revalidatePath("/ita-file");
  return {};
}

/**
 * Name search for the file picker in the OIT editor (F21).
 *
 * ADMIN+ like the rest of the library: it is a browsing surface over the same
 * data, and only editors can reach the editor it lives in. Returns an empty
 * list rather than an error, so the picker has nothing to leak.
 */
export async function searchFiles(term: string): Promise<PickerFile[]> {
  const user = await requireUser();
  if (!hasRole(user, "ADMIN", "SUPERADMIN")) return [];

  const parsed = z.string().max(255).safeParse(term);
  if (!parsed.success) return [];

  return searchFilesByName(parsed.data);
}

/**
 * Delete a file — its own uploader, or a SUPERADMIN for any file (D5).
 *
 * SUPERADMIN's reach is deliberate: when a staff member leaves, their uploads
 * would otherwise be undeletable by anyone.
 */
export async function deleteFile(formData: FormData): Promise<FileActionState> {
  const user = await requireUser();
  if (!hasRole(user, "ADMIN", "SUPERADMIN")) return { error: FORBIDDEN_MESSAGE };

  const parsed = deleteSchema.safeParse({ id: formData.get("id") });
  if (!parsed.success) return { error: "คำขอไม่ถูกต้อง" };

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

  revalidatePath("/ita-file");
  return {};
}
