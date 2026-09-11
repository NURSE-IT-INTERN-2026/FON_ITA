"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { logActivity } from "@/lib/activity/log";
import { FORBIDDEN_MESSAGE } from "@/lib/auth/errors";
import { getActorIfRole } from "@/lib/auth/guards";
import { prisma } from "@/lib/prisma";
import { Prisma } from "@/generated/prisma/client";

// Write side of ITA (F14). Every action re-checks the role here, not only in the
// page: a Server Action is its own entry point and can be invoked directly,
// whatever the UI shows.
//
// Unlike a page, an action returns the refusal as a normal result instead of
// raising forbidden() — the caller is a dialog that needs to display the reason,
// not navigate away from the form.

export type ItaActionState = { error?: string };

const YEAR_MESSAGE = "ปี พ.ศ. ต้องเป็นตัวเลข 4 หลัก";
const SAVE_FAILED = "บันทึกไม่สำเร็จ โปรดลองอีกครั้ง";
const DELETE_FAILED = "ลบไม่สำเร็จ โปรดลองอีกครั้ง";

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

// No `order` here on purpose. Ordering is drag-and-drop only (reorderIta), so
// the edit form has no field for it and this action must never move a topic by
// accident — the number a user last saw could be stale by the time they save.
const updateSchema = z.object({
  ...itaFields,
  id: z.coerce.number().int().positive(),
});

const deleteSchema = z.object({ id: z.coerce.number().int().positive() });

const reorderSchema = z.object({
  year: z.string().trim().regex(/^\d{4}$/, { message: YEAR_MESSAGE }),
  orderedIds: z.array(z.coerce.number().int().positive()).min(1),
});

/** Both list routes show the same rows, so both caches must drop. */
function revalidateItaViews(year: string) {
  revalidatePath("/ita-list");
  revalidatePath(`/ita/by-year/${year}`);
}

/** Next free slot in that year, inside the caller's advisory-locked transaction. */
async function nextOrder(tx: Prisma.TransactionClient, year: string): Promise<number> {
  const last = await tx.ita.findFirst({
    where: { year },
    orderBy: { order: "desc" },
    select: { order: true },
  });
  return (last?.order ?? 0) + 1;
}

/** Serialise writes that claim "the next free slot" in one year. */
async function lockYearOrder(tx: Prisma.TransactionClient, year: string): Promise<void> {
  await tx.$queryRaw`SELECT pg_advisory_xact_lock(hashtext(${year}))`;
}

export async function createIta(formData: FormData): Promise<ItaActionState> {
  const user = await getActorIfRole("ADMIN", "SUPERADMIN");
  if (!user) return { error: FORBIDDEN_MESSAGE };

  const parsed = createSchema.safeParse({
    title: formData.get("title"),
    year: formData.get("year"),
  });
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? YEAR_MESSAGE };

  const { title, year } = parsed.data;

  try {
    // Two concurrent creates would both read the same max at READ COMMITTED
    // and write the same slot. The advisory lock is keyed on the year and
    // lives for this transaction only; the `id` tiebreakers on the read
    // paths are the safety net if a slot ever still collides.
    await prisma.$transaction(async (tx) => {
      await lockYearOrder(tx, year);
      await tx.ita.create({
        data: { title, year, order: await nextOrder(tx, year), userId: user.id },
      });
    });

    await logActivity(user, "ita.create", { target: title, detail: `ปี ${year}` });

    revalidateItaViews(year);
    return {};
  } catch (error) {
    console.error("[ita] createIta failed", error);
    return { error: SAVE_FAILED };
  }
}

export async function updateIta(formData: FormData): Promise<ItaActionState> {
  const user = await getActorIfRole("ADMIN", "SUPERADMIN");
  if (!user) return { error: FORBIDDEN_MESSAGE };

  const parsed = updateSchema.safeParse({
    id: formData.get("id"),
    title: formData.get("title"),
    year: formData.get("year"),
  });
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? YEAR_MESSAGE };

  const { id, title, year } = parsed.data;

  try {
    const current = await prisma.ita.findUnique({ where: { id } });
    if (!current) return { error: "ไม่พบหัวข้อที่ต้องการแก้ไข" };

    if (year !== current.year) {
      // Moved to another year: its old order belongs to the old year's sequence
      // and would collide there, so the topic goes to the end of the new year.
      // Same advisory lock as createIta — the new year's next free slot must
      // not race a concurrent create or move into that same year.
      await prisma.$transaction(async (tx) => {
        await lockYearOrder(tx, year);
        await tx.ita.update({
          where: { id },
          data: { title, year, order: await nextOrder(tx, year) },
        });
      });
    } else {
      // Same year: only the title can have changed. The order stays exactly where
      // dragging last put it.
      await prisma.ita.update({ where: { id }, data: { title } });
    }

    await logActivity(user, "ita.update", {
      target: title,
      // Say what actually moved — a year change and a reorder read very
      // differently when someone is retracing what happened to a topic.
      detail:
        year !== current.year ? `ย้ายจากปี ${current.year} ไปปี ${year}` : `ปี ${year}`,
    });

    revalidateItaViews(year);
    // The old year's list changed too when the topic moved out of it.
    if (year !== current.year) revalidateItaViews(current.year);
    return {};
  } catch (error) {
    console.error("[ita] updateIta failed", error);
    return { error: SAVE_FAILED };
  }
}

export async function deleteIta(formData: FormData): Promise<ItaActionState> {
  const user = await getActorIfRole("ADMIN", "SUPERADMIN");
  if (!user) return { error: FORBIDDEN_MESSAGE };

  const parsed = deleteSchema.safeParse({ id: formData.get("id") });
  if (!parsed.success) return { error: "คำขอไม่ถูกต้อง" };

  try {
    const ita = await prisma.ita.findUnique({ where: { id: parsed.data.id } });
    if (!ita) return { error: "ไม่พบหัวข้อที่ต้องการลบ" };

    // OIT children go with it — `onDelete: Cascade` on the relation (F1).
    await prisma.ita.delete({ where: { id: ita.id } });

    await logActivity(user, "ita.delete", { target: ita.title, detail: `ปี ${ita.year}` });

    revalidateItaViews(ita.year);
    return {};
  } catch (error) {
    console.error("[ita] deleteIta failed", error);
    return { error: DELETE_FAILED };
  }
}

/**
 * Re-number 1..N within one year after a drag-and-drop reorder.
 *
 * Each id stays where the user dropped it; the rows in between shift to make
 * room. We re-number every row in the year, not just the two endpoints of the
 * drag — the dnd-kit `arrayMove` on the client produces a fully ordered list,
 * and applying that order directly is simpler and less error-prone than trying
 * to infer a swap from `active` and `over`.
 *
 * The `where: { id, year }` clause is belt-and-suspenders: `id` is already
 * unique, so scoping by year catches the case where a stale id from another
 * year slipped into the request and would otherwise be moved to the wrong year.
 */
export async function reorderIta(formData: FormData): Promise<ItaActionState> {
  const user = await getActorIfRole("ADMIN", "SUPERADMIN");
  if (!user) return { error: FORBIDDEN_MESSAGE };

  const parsed = reorderSchema.safeParse({
    year: formData.get("year"),
    orderedIds: formData.getAll("orderedIds"),
  });
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? YEAR_MESSAGE };

  const { year, orderedIds } = parsed.data;

  try {
    await prisma.$transaction(
      orderedIds.map((id, i) =>
        prisma.ita.updateMany({ where: { id, year }, data: { order: i + 1 } }),
      ),
    );

    await logActivity(user, "ita.reorder", { detail: `ปี ${year}` });

    revalidateItaViews(year);
    return {};
  } catch (error) {
    console.error("[ita] reorderIta failed", error);
    return { error: SAVE_FAILED };
  }
}
