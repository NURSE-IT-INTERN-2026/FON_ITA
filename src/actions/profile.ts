"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { logActivity } from "@/lib/activity/log";
import { requireUser } from "@/lib/auth/guards";
import { hashPassword, MIN_PASSWORD_LENGTH, verifyPassword } from "@/lib/auth/password";
import { createSession, getSessionLoginMethod, revokeAllSessions } from "@/lib/auth/session";
import { prisma } from "@/lib/prisma";
import { nameField } from "@/lib/users/validation";

// Own-account editing (F25). ADMIN+ in practice, because only staff have
// accounts at all (decisions.md D12) — but no role check is needed here beyond
// "signed in": everything below acts on the caller's own row, never an id from
// the request. That is what keeps this safe to expose to any account.

export type ProfileActionState = { error?: string };

const profileSchema = z.object({
  prefix: z.string().trim().max(50, { message: "คำนำหน้าต้องไม่เกิน 50 ตัวอักษร" }).optional(),
  firstname: nameField("ชื่อ"),
  lastname: nameField("นามสกุล"),
});

const passwordSchema = z
  .object({
    // Blank is allowed here and rejected below only when the account has a
    // password to check against — a CMU-only account is setting its first one,
    // and a CMU-login session stands in for the password (D27).
    current: z.string(),
    next: z
      .string()
      .min(MIN_PASSWORD_LENGTH, {
        message: `รหัสผ่านใหม่ต้องมีอย่างน้อย ${MIN_PASSWORD_LENGTH} ตัวอักษร`,
      })
      .max(200, { message: "รหัสผ่านยาวเกินไป" }),
    confirm: z.string(),
  })
  .refine((v) => v.next === v.confirm, {
    message: "รหัสผ่านใหม่ทั้งสองช่องไม่ตรงกัน",
    path: ["confirm"],
  });

/**
 * Name and prefix only.
 *
 * Email and CMU account are deliberately not editable: both are login
 * identifiers, and letting someone change their own would let a compromised
 * session take the account somewhere its owner cannot follow. A SUPERADMIN
 * cannot change them either (F24) — that is a deletion-and-recreation.
 */
export async function updateProfile(formData: FormData): Promise<ProfileActionState> {
  const user = await requireUser();

  const parsed = profileSchema.safeParse({
    prefix: (formData.get("prefix") as string | null)?.trim() || undefined,
    firstname: formData.get("firstname"),
    lastname: formData.get("lastname"),
  });
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "ข้อมูลไม่ถูกต้อง" };

  const { prefix, firstname, lastname } = parsed.data;

  await prisma.user.update({
    where: { id: user.id },
    data: { prefix: prefix ?? null, firstname, lastname },
  });

  await logActivity(user, "profile.update", {
    target: `${prefix ?? ""}${firstname} ${lastname}`.trim(),
  });

  // The header shows the name, so every page carrying the shell is now stale.
  revalidatePath("/", "layout");
  return {};
}

/**
 * Change (or set) the caller's own password.
 *
 * On success every session is revoked and a fresh one is issued for the browser
 * that made the change. That is the point: a password change is how someone
 * ends a session they no longer trust, and leaving the others alive would make
 * it useless. Signing the caller out too would work but punishes the person
 * doing the right thing.
 */
export async function changePassword(formData: FormData): Promise<ProfileActionState> {
  const user = await requireUser();

  const parsed = passwordSchema.safeParse({
    current: formData.get("current") ?? "",
    next: formData.get("next") ?? "",
    confirm: formData.get("confirm") ?? "",
  });
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "ข้อมูลไม่ถูกต้อง" };

  const { current, next } = parsed.data;

  // Read the hash from the database rather than the session: SessionUser does
  // not carry it, and it must not start doing so.
  const row = await prisma.user.findUnique({
    where: { id: user.id },
    select: { password: true },
  });
  if (!row) return { error: "ไม่พบบัญชีของคุณ" };

  const hadPassword = row.password !== null;

  // A CMU-only account has nothing to verify against and is setting its first
  // password. Whoever is asking already holds a valid session for the account,
  // which is the same level of proof the current-password check provides.
  //
  // The other way past the check (D27): a session signed in through CMU OAuth.
  // Microsoft authenticated the account owner to start it, which is exactly
  // what the forgotten current password cannot prove.
  const cmuVerified = user.loginMethod === "CMU_OAUTH";
  if (hadPassword && !cmuVerified && !(await verifyPassword(current, row.password))) {
    return { error: "รหัสผ่านปัจจุบันไม่ถูกต้อง" };
  }

  if (hadPassword && (await verifyPassword(next, row.password))) {
    return { error: "รหัสผ่านใหม่ต้องไม่ซ้ำกับรหัสผ่านเดิม" };
  }

  await prisma.user.update({
    where: { id: user.id },
    data: { password: await hashPassword(next), mustResetPassword: false },
  });

  // Read before revoking — the row is gone afterwards.
  const loginMethod = (await getSessionLoginMethod()) ?? "PASSWORD";
  await revokeAllSessions(user.id);
  // Order matters: revoke first, then issue. The reverse would delete the new
  // session along with the old ones and log the caller out.
  await createSession(user.id, loginMethod);

  await logActivity(user, "profile.password_change", {
    detail: hadPassword
      ? cmuVerified && current === ""
        ? "ยืนยันตัวตนด้วยบัญชี CMU · ออกจากระบบอุปกรณ์อื่นทั้งหมด"
        : "ออกจากระบบอุปกรณ์อื่นทั้งหมด"
      : "ตั้งรหัสผ่านครั้งแรก",
  });

  return {};
}
