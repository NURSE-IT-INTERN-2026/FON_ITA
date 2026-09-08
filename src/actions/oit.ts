"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { logActivity } from "@/lib/activity/log";
import { FORBIDDEN_MESSAGE } from "@/lib/auth/errors";
import { getActorIfRole } from "@/lib/auth/guards";
import { prisma } from "@/lib/prisma";
import { htmlToText, sanitizeHtml } from "@/lib/sanitize";

// Write side of OIT (F16). Same shape as the ITA actions: the role is re-checked
// here, and a refusal comes back as a value so the form can show it.

export type OitActionState = { error?: string };

/** F17 — the editor caps content at 1000 characters; the server enforces it. */
const CONTENT_LIMIT = 1000;

const SAVE_FAILED = "บันทึกไม่สำเร็จ โปรดลองอีกครั้ง";
const DELETE_FAILED = "ลบไม่สำเร็จ โปรดลองอีกครั้ง";

const oitFields = {
  title: z
    .string()
    .trim()
    .min(1, { message: "กรุณากรอกชื่อ OIT" })
    .max(255, { message: "ชื่อ OIT ต้องไม่เกิน 255 ตัวอักษร" }),
  link: z
    .string()
    .trim()
    .max(2048, { message: "ลิงก์ยาวเกินไป" })
    // Optional, but if given it must be a real http(s) URL — the list opens it
    // in a new tab, so `javascript:` must never get through.
    .refine((v) => v === "" || /^https?:\/\/\S+$/i.test(v), {
      message: "ลิงก์ต้องขึ้นต้นด้วย http:// หรือ https://",
    }),
  content: z.string().max(20000, { message: "เนื้อหายาวเกินไป" }),
};

const createSchema = z.object({ ...oitFields, itaId: z.coerce.number().int().positive() });
const updateSchema = z.object({ ...oitFields, id: z.coerce.number().int().positive() });
const deleteSchema = z.object({ id: z.coerce.number().int().positive() });

function revalidateOitViews(itaId: number, year: string, oitId?: number) {
  revalidatePath("/ita-list");
  revalidatePath(`/ita/by-year/${year}`);
  if (oitId) revalidatePath(`/ita-oit/${oitId}`);
  revalidatePath(`/ita-oit/create/${itaId}`);
}

/**
 * Clean the editor's HTML and check its visible length.
 *
 * Sanitising happens on create AND update — the Laravel system only did it on
 * create, so an edit could reintroduce anything the editor had been cleaned of.
 */
function prepareContent(raw: string): { content: string | null } | { error: string } {
  const content = sanitizeHtml(raw);
  const text = htmlToText(content);

  if (text.length > CONTENT_LIMIT) {
    return { error: `เนื้อหาต้องไม่เกิน ${CONTENT_LIMIT} ตัวอักษร (ขณะนี้ ${text.length})` };
  }

  // An "empty" Tiptap document is still "<p></p>"; store null so the UI can tell
  // "no content" from "content that happens to be blank".
  return { content: text.length === 0 ? null : content };
}

export async function createOit(formData: FormData): Promise<OitActionState> {
  const user = await getActorIfRole("ADMIN", "SUPERADMIN");
  if (!user) return { error: FORBIDDEN_MESSAGE };

  const parsed = createSchema.safeParse({
    itaId: formData.get("itaId"),
    title: formData.get("title"),
    link: formData.get("link") ?? "",
    content: formData.get("content") ?? "",
  });
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "ข้อมูลไม่ถูกต้อง" };

  const { itaId, title, link } = parsed.data;
  const prepared = prepareContent(parsed.data.content);
  if ("error" in prepared) return { error: prepared.error };

  try {
    const ita = await prisma.ita.findUnique({ where: { id: itaId } });
    if (!ita) return { error: "ไม่พบหัวข้อ ITA ที่ต้องการเพิ่ม OIT" };

    await prisma.oit.create({
      data: { itaId, title, link: link || null, content: prepared.content },
    });

    await logActivity(user, "oit.create", {
      target: title,
      detail: `ภายใต้ ${ita.title} (ปี ${ita.year})`,
    });

    revalidateOitViews(itaId, ita.year);
    return {};
  } catch (error) {
    console.error("[oit] createOit failed", error);
    return { error: SAVE_FAILED };
  }
}

export async function updateOit(formData: FormData): Promise<OitActionState> {
  const user = await getActorIfRole("ADMIN", "SUPERADMIN");
  if (!user) return { error: FORBIDDEN_MESSAGE };

  const parsed = updateSchema.safeParse({
    id: formData.get("id"),
    title: formData.get("title"),
    link: formData.get("link") ?? "",
    content: formData.get("content") ?? "",
  });
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "ข้อมูลไม่ถูกต้อง" };

  const { id, title, link } = parsed.data;
  const prepared = prepareContent(parsed.data.content);
  if ("error" in prepared) return { error: prepared.error };

  try {
    const existing = await prisma.oit.findUnique({
      where: { id },
      // The parent's title and the old OIT title are read for the activity log —
      // the log has to say what was edited even after the title has changed.
      select: { itaId: true, title: true, ita: { select: { year: true, title: true } } },
    });
    if (!existing) return { error: "ไม่พบ OIT ที่ต้องการแก้ไข" };

    await prisma.oit.update({
      where: { id },
      data: { title, link: link || null, content: prepared.content },
    });

    await logActivity(user, "oit.update", {
      target: title,
      detail:
        existing.title === title
          ? `ภายใต้ ${existing.ita.title} (ปี ${existing.ita.year})`
          : `เดิม "${existing.title}" · ภายใต้ ${existing.ita.title} (ปี ${existing.ita.year})`,
    });

    revalidateOitViews(existing.itaId, existing.ita.year, id);
    return {};
  } catch (error) {
    console.error("[oit] updateOit failed", error);
    return { error: SAVE_FAILED };
  }
}

export async function deleteOit(formData: FormData): Promise<OitActionState> {
  const user = await getActorIfRole("ADMIN", "SUPERADMIN");
  if (!user) return { error: FORBIDDEN_MESSAGE };

  const parsed = deleteSchema.safeParse({ id: formData.get("id") });
  if (!parsed.success) return { error: "คำขอไม่ถูกต้อง" };

  try {
    const existing = await prisma.oit.findUnique({
      where: { id: parsed.data.id },
      select: { id: true, itaId: true, title: true, ita: { select: { year: true, title: true } } },
    });
    if (!existing) return { error: "ไม่พบ OIT ที่ต้องการลบ" };

    await prisma.oit.delete({ where: { id: existing.id } });

    await logActivity(user, "oit.delete", {
      target: existing.title,
      detail: `ภายใต้ ${existing.ita.title} (ปี ${existing.ita.year})`,
    });

    revalidateOitViews(existing.itaId, existing.ita.year, existing.id);
    return {};
  } catch (error) {
    console.error("[oit] deleteOit failed", error);
    return { error: DELETE_FAILED };
  }
}
