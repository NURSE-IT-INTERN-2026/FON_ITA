"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { logActivity } from "@/lib/activity/log";
import { FORBIDDEN_MESSAGE } from "@/lib/auth/errors";
import { getActorIfRole } from "@/lib/auth/guards";
import { hashPassword, MIN_PASSWORD_LENGTH } from "@/lib/auth/password";
import { revokeAllSessions } from "@/lib/auth/session";
import { roleLabel } from "@/components/misc/role-badge";
import { prisma } from "@/lib/prisma";
import { countActiveSuperadmins } from "@/lib/users/queries";
import { nameField } from "@/lib/users/validation";

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
//   • Disabling (`status = false`) is the only way to retire an account —
//     reversible, keeps every reference intact. Hard delete was removed
//     entirely (D26 repealed 10 ก.ย. 2569): no button, no action.

export type UserActionState = { error?: string };

const SAVE_FAILED = "บันทึกไม่สำเร็จ โปรดลองอีกครั้ง";
const DISABLE_FAILED = "ปิดใช้งานไม่สำเร็จ โปรดลองอีกครั้ง";
const RESTORE_FAILED = "เปิดใช้งานไม่สำเร็จ โปรดลองอีกครั้ง";

/**
 * Only CMU addresses may be registered.
 *
 * Every account here belongs to faculty staff who sign in through CMU OAuth
 * (D7 · the password form is the fallback), and `cmu_account` — the value the
 * OAuth callback matches on — is derived from the part before the @. Accepting
 * an outside address would create a row that can never sign in through the main
 * channel, while still occupying a `cmu_account` that a real CMU login could
 * collide with.
 *
 * Subdomains are deliberately NOT accepted: `@nurse.cmu.ac.th` does not end with
 * `@cmu.ac.th`. Add entries here if the faculty turns out to use others.
 */
const ALLOWED_EMAIL_DOMAINS = ["cmu.ac.th"];

const emailField = z
  .string()
  // Trim and lowercase BEFORE validating, not after. `z.email().trim()` checks
  // the format first, so a pasted address with a trailing space is rejected as
  // "รูปแบบอีเมลไม่ถูกต้อง" — an error about something the person cannot see.
  // Lowercased because PostgreSQL compares text case-sensitively and login
  // normalises the same way (F7).
  .trim()
  .toLowerCase()
  .pipe(z.email({ message: "รูปแบบอีเมลไม่ถูกต้อง" }))
  .refine(
    (value) => ALLOWED_EMAIL_DOMAINS.some((domain) => value.endsWith(`@${domain}`)),
    { message: `ต้องเป็นอีเมล @${ALLOWED_EMAIL_DOMAINS.join(" หรือ @")} เท่านั้น` },
  );

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
  email: emailField,
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

/** Blocks an action that would leave zero active SUPERADMIN accounts. */
async function guardLastSuperadmin(
  wouldRemoveActiveSuperadmin: boolean,
): Promise<UserActionState | null> {
  if (!wouldRemoveActiveSuperadmin) return null;
  if ((await countActiveSuperadmins()) > 1) return null;
  return { error: "ต้องมีผู้ดูแลสูงสุดที่ใช้งานได้อย่างน้อย 1 บัญชี" };
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
  const actor = await getActorIfRole("SUPERADMIN");
  if (!actor) return { error: FORBIDDEN_MESSAGE };

  const parsed = createSchema.safeParse({ ...fields(formData), email: formData.get("email") });
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "ข้อมูลไม่ถูกต้อง" };

  const { email, password, prefix, firstname, lastname, role, mustReset } = parsed.data;

  try {
    // No identity confirmation on create (D23, amended 26 ส.ค. 2569): a brand-new
    // account hands the operator nothing they did not already control — and the
    // same amendment later dropped the confirmation from the edit path too.
    const existing = await prisma.user.findUnique({ where: { email } });
    if (existing) return { error: "มีบัญชีที่ใช้อีเมลนี้อยู่แล้ว" };

    // The local part of the CMU email, matching the legacy column and what the
    // OAuth callback compares against (F8).
    const cmuAccount = email.split("@")[0];

    // Checked separately from the email: two different emails can share a local
    // part, and this is the value CMU login actually matches on. Without this the
    // second row would be created and the OAuth lookup would pick between them
    // arbitrarily. The database rejects it too (`cmuAccount @unique`) — this exists
    // so the person sees a sentence instead of a constraint violation.
    const clash = await prisma.user.findUnique({ where: { cmuAccount } });
    if (clash) {
      return {
        error: `บัญชี CMU "${cmuAccount}" ถูกใช้กับ ${clash.email} อยู่แล้ว — ใช้อีเมลอื่นหรือแก้ไขบัญชีเดิมแทน`,
      };
    }

    const created = await prisma.user.create({
      data: {
        email,
        cmuAccount,
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
        // Thai label, not the enum: this line is what the activity log shows the
        // person, and "ADMIN" reads as noise next to everything else being Thai.
        roleLabel(role),
        created.mustResetPassword ? "บังคับตั้งรหัสผ่านใหม่เมื่อเข้าใช้" : null,
      ]
        .filter(Boolean)
        .join(" · "),
    });

    revalidatePath("/user-management");
    return {};
  } catch (error) {
    console.error("[user] createUser failed", error);
    // The checks above race with a concurrent create; the unique indexes on
    // email and cmuAccount are what actually holds the line.
    if (error instanceof Error && "code" in error && error.code === "P2002") {
      return { error: "มีบัญชีที่ใช้อีเมลนี้อยู่แล้ว" };
    }
    return { error: SAVE_FAILED };
  }
}

export async function updateUser(formData: FormData): Promise<UserActionState> {
  const actor = await getActorIfRole("SUPERADMIN");
  if (!actor) return { error: FORBIDDEN_MESSAGE };

  const parsed = updateSchema.safeParse({ ...fields(formData), id: formData.get("id") });
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "ข้อมูลไม่ถูกต้อง" };

  const { id, prefix, firstname, lastname, role, password, mustReset } = parsed.data;

  try {
    const target = await prisma.user.findUnique({ where: { id } });
    if (!target) return { error: "ไม่พบบัญชีที่ต้องการแก้ไข" };

    // An account with no password logs in through CMU only (D7). Giving it one
    // creates a second way in that its owner never asked for and would not know
    // about. The owner can set their own at /profile, where holding the session is
    // the proof — nobody else can do it for them.
    if (password && !target.password) {
      return {
        error:
          target.id === actor.id
            ? "บัญชีของคุณยังไม่มีรหัสผ่าน — ตั้งครั้งแรกได้ที่หน้าโปรไฟล์ของคุณเอง"
            : "บัญชีนี้ใช้ล็อกอินด้วยบัญชี CMU เท่านั้น — ให้เจ้าของบัญชีตั้งรหัสผ่านเองที่หน้าโปรไฟล์",
      };
    }

    // No actor confirmation (D23, fully repealed 26 ส.ค. 2569): SUPERADMIN already
    // holds the highest privilege, so re-proving it proves nothing new — the
    // activity log records who made the change instead.
    const losingSuperadmin = target.role === "SUPERADMIN" && role !== "SUPERADMIN";

    // Changing your own role is refused outright: it is the one edit that can
    // take away the ability to undo itself.
    if (losingSuperadmin && target.id === actor.id) {
      return { error: "เปลี่ยนบทบาทของบัญชีตนเองไม่ได้" };
    }

    // Someone must be left who can manage users.
    const superadminGuard = await guardLastSuperadmin(losingSuperadmin && target.status);
    if (superadminGuard) return superadminGuard;

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
        target.role !== role ? `บทบาท ${roleLabel(target.role)} → ${roleLabel(role)}` : null,
        password ? "ตั้งรหัสผ่านใหม่ (ออกจากระบบทุกอุปกรณ์)" : null,
        password && mustReset ? "บังคับตั้งรหัสผ่านใหม่เมื่อเข้าใช้" : null,
      ]
        .filter(Boolean)
        .join(" · ") || target.email,
    });

    revalidatePath("/user-management");
    return {};
  } catch (error) {
    console.error("[user] updateUser failed", error);
    return { error: SAVE_FAILED };
  }
}

/**
 * Disable an account. Its sessions are revoked immediately; `getSessionUser()`
 * also rejects `status = false` on the next request either way (F5).
 */
export async function disableUser(formData: FormData): Promise<UserActionState> {
  const actor = await getActorIfRole("SUPERADMIN");
  if (!actor) return { error: FORBIDDEN_MESSAGE };

  const parsed = idSchema.safeParse({ id: formData.get("id") });
  if (!parsed.success) return { error: "คำขอไม่ถูกต้อง" };

  try {
    const target = await prisma.user.findUnique({ where: { id: parsed.data.id } });
    if (!target) return { error: "ไม่พบบัญชีที่ต้องการปิดใช้งาน" };
    if (target.id === actor.id) return { error: "ปิดใช้งานบัญชีของตนเองไม่ได้" };

    const superadminGuard = await guardLastSuperadmin(target.role === "SUPERADMIN");
    if (superadminGuard) return superadminGuard;

    await prisma.user.update({ where: { id: target.id }, data: { status: false } });
    await revokeAllSessions(target.id);

    await logActivity(actor, "user.disable", {
      target: `${target.firstname} ${target.lastname}`.trim(),
      detail: target.email,
    });

    revalidatePath("/user-management");
    return {};
  } catch (error) {
    console.error("[user] disableUser failed", error);
    return { error: DISABLE_FAILED };
  }
}

/** Re-enable a disabled account, from the "ปิดใช้งาน" tab. */
export async function restoreUser(formData: FormData): Promise<UserActionState> {
  const actor = await getActorIfRole("SUPERADMIN");
  if (!actor) return { error: FORBIDDEN_MESSAGE };

  const parsed = idSchema.safeParse({ id: formData.get("id") });
  if (!parsed.success) return { error: "คำขอไม่ถูกต้อง" };

  try {
    const target = await prisma.user.findUnique({ where: { id: parsed.data.id } });
    if (!target) return { error: "ไม่พบบัญชีที่ต้องการเปิดใช้งาน" };

    await prisma.user.update({ where: { id: target.id }, data: { status: true } });

    await logActivity(actor, "user.restore", {
      target: `${target.firstname} ${target.lastname}`.trim(),
      detail: target.email,
    });

    revalidatePath("/user-management");
    return {};
  } catch (error) {
    console.error("[user] restoreUser failed", error);
    return { error: RESTORE_FAILED };
  }
}
