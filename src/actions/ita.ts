"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { logActivity } from "@/lib/activity/log";
import { FORBIDDEN_MESSAGE } from "@/lib/auth/errors";
import { requireUser } from "@/lib/auth/guards";
import { hasRole } from "@/lib/auth/roles";
import { prisma } from "@/lib/prisma";

// Write side of ITA (F14). Every action re-checks the role here, not only in the
// page: a Server Action is its own entry point and can be invoked directly,
// whatever the UI shows.
//
// Unlike a page, an action returns the refusal as a normal result instead of
// raising forbidden() — the caller is a dialog that needs to display the reason,
// not navigate away from the form.

export type ItaActionState = { error?: string };

const YEAR_MESSAGE = "ปี พ.ศ. ต้องเป็นตัวเลข 4 หลัก";

const itaFields = {
  title: z
    .string()
    .trim()
    .min(1, { message: "กรุณากรอกชื่อหัวข้อ" })
    .max(255, { message: "ชื่อหัวข้อต้องไม่เกิน 255 ตัวอักษร" }),
  // Stored as a string — the frozen Public API returns it that way (F27).
  year: z.string().trim().regex(/^\d{4}$/, { message: YEAR_MESSAGE }),
};

const createSchema = z.object(itaFields);

const updateSchema = z.object({
  ...itaFields,
  id: z.coerce.number().int().positive(),
  order: z.coerce
    .number({ message: "ลำดับต้องเป็นตัวเลข" })
    .int({ message: "ลำดับต้องเป็นจำนวนเต็ม" })
    .min(1, { message: "ลำดับต้องเริ่มจาก 1" }),
});

const deleteSchema = z.object({ id: z.coerce.number().int().positive() });

/** ADMIN and SUPERADMIN may write; USER may only read (role matrix, D4/D5). */
async function requireEditor() {
  const user = await requireUser();
  return hasRole(user, "ADMIN", "SUPERADMIN") ? user : null;
}

/** Both list routes show the same rows, so both caches must drop. */
function revalidateItaViews(year: string) {
  revalidatePath("/ita-list");
  revalidatePath(`/ita/by-year/${year}`);
}

/** Next free slot in that year. Order is per-year, matching the list view. */
async function nextOrder(year: string): Promise<number> {
  const last = await prisma.ita.findFirst({
    where: { year },
    orderBy: { order: "desc" },
    select: { order: true },
  });
  return (last?.order ?? 0) + 1;
}

export async function createIta(formData: FormData): Promise<ItaActionState> {
  const user = await requireEditor();
  if (!user) return { error: FORBIDDEN_MESSAGE };

  const parsed = createSchema.safeParse({
    title: formData.get("title"),
    year: formData.get("year"),
  });
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? YEAR_MESSAGE };

  const { title, year } = parsed.data;

  await prisma.ita.create({
    data: { title, year, order: await nextOrder(year), userId: user.id },
  });

  await logActivity(user, "ita.create", { target: title, detail: `ปี ${year}` });

  revalidateItaViews(year);
  return {};
}

export async function updateIta(formData: FormData): Promise<ItaActionState> {
  const user = await requireEditor();
  if (!user) return { error: FORBIDDEN_MESSAGE };

  const parsed = updateSchema.safeParse({
    id: formData.get("id"),
    title: formData.get("title"),
    year: formData.get("year"),
    order: formData.get("order"),
  });
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? YEAR_MESSAGE };

  const { id, title, year, order } = parsed.data;

  const current = await prisma.ita.findUnique({ where: { id } });
  if (!current) return { error: "ไม่พบหัวข้อที่ต้องการแก้ไข" };

  await prisma.$transaction(async (tx) => {
    if (year !== current.year) {
      // Moved to another year: the submitted order belongs to the old year's
      // sequence and would collide, so the topic goes to the end of the new one.
      const last = await tx.ita.findFirst({
        where: { year },
        orderBy: { order: "desc" },
        select: { order: true },
      });
      await tx.ita.update({
        where: { id },
        data: { title, year, order: (last?.order ?? 0) + 1 },
      });
      return;
    }

    if (order !== current.order) {
      // Swap rather than shift everything — the legacy Laravel behaviour, and it
      // keeps the change to two rows. Inside a transaction so the two rows can
      // never both hold the same order.
      const occupant = await tx.ita.findFirst({
        where: { year, order, id: { not: id } },
      });
      if (occupant) {
        await tx.ita.update({ where: { id: occupant.id }, data: { order: current.order } });
      }
    }

    await tx.ita.update({ where: { id }, data: { title, year, order } });
  });

  await logActivity(user, "ita.update", {
    target: title,
    // Say what actually moved — a year change and a reorder read very
    // differently when someone is retracing what happened to a topic.
    detail:
      year !== current.year
        ? `ย้ายจากปี ${current.year} ไปปี ${year}`
        : `ปี ${year}${order !== current.order ? ` · ลำดับ ${current.order} → ${order}` : ""}`,
  });

  revalidateItaViews(year);
  // The old year's list changed too when the topic moved out of it.
  if (year !== current.year) revalidateItaViews(current.year);
  return {};
}

export async function deleteIta(formData: FormData): Promise<ItaActionState> {
  const user = await requireEditor();
  if (!user) return { error: FORBIDDEN_MESSAGE };

  const parsed = deleteSchema.safeParse({ id: formData.get("id") });
  if (!parsed.success) return { error: "คำขอไม่ถูกต้อง" };

  const ita = await prisma.ita.findUnique({ where: { id: parsed.data.id } });
  if (!ita) return { error: "ไม่พบหัวข้อที่ต้องการลบ" };

  // OIT children go with it — `onDelete: Cascade` on the relation (F1).
  await prisma.ita.delete({ where: { id: ita.id } });

  await logActivity(user, "ita.delete", { target: ita.title, detail: `ปี ${ita.year}` });

  revalidateItaViews(ita.year);
  return {};
}
