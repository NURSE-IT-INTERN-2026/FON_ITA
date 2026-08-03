"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { logActivity } from "@/lib/activity/log";
import { FORBIDDEN_MESSAGE } from "@/lib/auth/errors";
import { requireUser } from "@/lib/auth/guards";
import { hashPassword } from "@/lib/auth/password";
import { revokeAllSessions } from "@/lib/auth/session";
import { prisma } from "@/lib/prisma";
import { countActiveSuperadmins } from "@/lib/users/queries";

// User management (F24) — SUPERADMIN only (decisions.md D4).
//
// Three rules run through everything here:
//   • SUPERADMIN accounts CAN be created and edited here (decisions.md D13).
//     What is protected is the role itself: the last active SUPERADMIN cannot
//     be demoted or disabled, and nobody can demote or disable themselves. Those
//     two rules together make it impossible to lock everyone out.
//   • New accounts are ADMIN or SUPERADMIN only. USER exists in the enum for
//     legacy rows (D12) and is offered only when editing an account that is
//     already USER — never as a way to create one.
//   • "Deleting" is disabling (`status = false`). ItaFile rows reference users,
//     and an upload's history should survive the uploader leaving.

export type UserActionState = { error?: string };

/** Minimum for an account created here. The bootstrap admin uses a longer one. */
const MIN_PASSWORD_LENGTH = 8;

const nameField = (label: string) =>
  z
    .string()
    .trim()
    .min(1, { message: `กรุณากรอก${label}` })
    .max(100, { message: `${label}ต้องไม่เกิน 100 ตัวอักษร` });

/** Roles a new account may be given. USER is not one — see the note at the top. */
const createRoleField = z.enum(["ADMIN", "SUPERADMIN"], { message: "บทบาทไม่ถูกต้อง" });

/** Editing also accepts USER, so an existing legacy row can be saved as-is. */
const updateRoleField = z.enum(["ADMIN", "SUPERADMIN", "USER"], { message: "บทบาทไม่ถูกต้อง" });

const passwordField = z
  .string()
  .refine((v) => v === "" || v.length >= MIN_PASSWORD_LENGTH, {
    message: `รหัสผ่านต้องมีอย่างน้อย ${MIN_PASSWORD_LENGTH} ตัวอักษร`,
  });

const createSchema = z.object({
  prefix: z.string().trim().max(50).optional(),
  firstname: nameField("ชื่อ"),
  lastname: nameField("นามสกุล"),
  // Lowercased because PostgreSQL compares text case-sensitively and login
  // normalises the same way (F7).
  email: z.email({ message: "รูปแบบอีเมลไม่ถูกต้อง" }).trim().toLowerCase(),
  role: createRoleField,
  password: passwordField,
  mustReset: z.boolean(),
});

const updateSchema = z.object({
  id: z.coerce.number().int().positive(),
  prefix: z.string().trim().max(50).optional(),
  firstname: nameField("ชื่อ"),
  lastname: nameField("นามสกุล"),
  role: updateRoleField,
  // Blank means "leave the current password alone".
  password: passwordField,
  mustReset: z.boolean(),
});

const idSchema = z.object({ id: z.coerce.number().int().positive() });

async function requireSuperadmin() {
  const user = await requireUser();
  return user.role === "SUPERADMIN" ? user : null;
}

function fields(formData: FormData) {
  return {
    prefix: (formData.get("prefix") as string | null)?.trim() || undefined,
    firstname: formData.get("firstname"),
    lastname: formData.get("lastname"),
    role: formData.get("role"),
    password: (formData.get("password") as string | null) ?? "",
    // An unchecked checkbox sends nothing at all, so absence is the "false".
    mustReset: formData.get("mustReset") === "on",
  };
}

export async function createUser(formData: FormData): Promise<UserActionState> {
  const actor = await requireSuperadmin();
  if (!actor) return { error: FORBIDDEN_MESSAGE };

  const parsed = createSchema.safeParse({ ...fields(formData), email: formData.get("email") });
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "ข้อมูลไม่ถูกต้อง" };

  const { email, password, prefix, firstname, lastname, role, mustReset } = parsed.data;

  const existing = await prisma.user.findUnique({ where: { email } });
  if (existing) return { error: "มีบัญชีที่ใช้อีเมลนี้อยู่แล้ว" };

  const created = await prisma.user.create({
    data: {
      email,
      // The local part of the CMU email, matching the legacy column and what
      // the OAuth callback compares against (F8).
      cmuAccount: email.split("@")[0],
      prefix: prefix ?? null,
      firstname,
      lastname,
      role,
      // No password means CMU OAuth only — valid, and the schema allows it.
      password: password ? await hashPassword(password) : null,
      // Only meaningful alongside a password: the forced-reset gate (F34) fires
      // on password sessions, so flagging a CMU-only account would do nothing
      // but leave a confusing row in the database.
      mustResetPassword: !!password && mustReset,
      status: true,
    },
  });

  await logActivity(actor, "user.create", {
    target: `${firstname} ${lastname}`.trim(),
    detail: [
      created.email,
      role,
      created.mustResetPassword ? "บังคับตั้งรหัสผ่านใหม่เมื่อเข้าใช้" : null,
    ]
      .filter(Boolean)
      .join(" · "),
  });

  revalidatePath("/user-management");
  return {};
}

export async function updateUser(formData: FormData): Promise<UserActionState> {
  const actor = await requireSuperadmin();
  if (!actor) return { error: FORBIDDEN_MESSAGE };

  const parsed = updateSchema.safeParse({ ...fields(formData), id: formData.get("id") });
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "ข้อมูลไม่ถูกต้อง" };

  const { id, prefix, firstname, lastname, role, password, mustReset } = parsed.data;

  const target = await prisma.user.findUnique({ where: { id } });
  if (!target) return { error: "ไม่พบบัญชีที่ต้องการแก้ไข" };

  const losingSuperadmin = target.role === "SUPERADMIN" && role !== "SUPERADMIN";

  // Changing your own role is refused outright: it is the one edit that can
  // take away the ability to undo itself.
  if (losingSuperadmin && target.id === actor.id) {
    return { error: "เปลี่ยนบทบาทของบัญชีตนเองไม่ได้" };
  }

  // Someone must be left who can manage users.
  if (losingSuperadmin && target.status && (await countActiveSuperadmins()) <= 1) {
    return { error: "ต้องมีผู้ดูแลสูงสุดที่ใช้งานได้อย่างน้อย 1 บัญชี" };
  }

  await prisma.user.update({
    where: { id },
    data: {
      prefix: prefix ?? null,
      firstname,
      lastname,
      role,
      ...(password
        ? { password: await hashPassword(password), mustResetPassword: mustReset }
        : {}),
    },
  });

  // A new password must invalidate whatever is still signed in as them —
  // otherwise resetting a compromised account changes nothing.
  if (password) await revokeAllSessions(id);

  await logActivity(actor, "user.update", {
    target: `${firstname} ${lastname}`.trim(),
    detail: [
      target.role !== role ? `บทบาท ${target.role} → ${role}` : null,
      password ? "ตั้งรหัสผ่านใหม่ (ออกจากระบบทุกอุปกรณ์)" : null,
      password && mustReset ? "บังคับตั้งรหัสผ่านใหม่เมื่อเข้าใช้" : null,
    ]
      .filter(Boolean)
      .join(" · ") || target.email,
  });

  revalidatePath("/user-management");
  return {};
}

/**
 * Disable an account. Its sessions are revoked immediately; `getSessionUser()`
 * also rejects `status = false` on the next request either way (F5).
 */
export async function disableUser(formData: FormData): Promise<UserActionState> {
  const actor = await requireSuperadmin();
  if (!actor) return { error: FORBIDDEN_MESSAGE };

  const parsed = idSchema.safeParse({ id: formData.get("id") });
  if (!parsed.success) return { error: "คำขอไม่ถูกต้อง" };

  const target = await prisma.user.findUnique({ where: { id: parsed.data.id } });
  if (!target) return { error: "ไม่พบบัญชีที่ต้องการปิดใช้งาน" };
  if (target.id === actor.id) return { error: "ปิดใช้งานบัญชีของตนเองไม่ได้" };

  if (target.role === "SUPERADMIN" && (await countActiveSuperadmins()) <= 1) {
    return { error: "ต้องมีผู้ดูแลสูงสุดที่ใช้งานได้อย่างน้อย 1 บัญชี" };
  }

  await prisma.user.update({ where: { id: target.id }, data: { status: false } });
  await revokeAllSessions(target.id);

  await logActivity(actor, "user.disable", {
    target: `${target.firstname} ${target.lastname}`.trim(),
    detail: target.email,
  });

  revalidatePath("/user-management");
  return {};
}

/** Re-enable a disabled account, from the "ปิดใช้งาน" tab. */
export async function restoreUser(formData: FormData): Promise<UserActionState> {
  const actor = await requireSuperadmin();
  if (!actor) return { error: FORBIDDEN_MESSAGE };

  const parsed = idSchema.safeParse({ id: formData.get("id") });
  if (!parsed.success) return { error: "คำขอไม่ถูกต้อง" };

  const target = await prisma.user.findUnique({ where: { id: parsed.data.id } });
  if (!target) return { error: "ไม่พบบัญชีที่ต้องการเปิดใช้งาน" };

  await prisma.user.update({ where: { id: target.id }, data: { status: true } });

  await logActivity(actor, "user.restore", {
    target: `${target.firstname} ${target.lastname}`.trim(),
    detail: target.email,
  });

  revalidatePath("/user-management");
  return {};
}
