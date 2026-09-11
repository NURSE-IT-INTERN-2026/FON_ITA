"use server";

import { redirect } from "next/navigation";
import { z } from "zod";
import { logActivity } from "@/lib/activity/log";
import { needsPasswordReset, requireSession } from "@/lib/auth/guards";
import {
  hashPassword,
  MAX_PASSWORD_LENGTH,
  MIN_PASSWORD_LENGTH,
  verifyPassword,
} from "@/lib/auth/password";
import { ROLE_HOME } from "@/lib/auth/roles";
import { createSession, revokeAllSessions } from "@/lib/auth/session";
import { prisma } from "@/lib/prisma";

// Forced password reset (F34) — the one thing a session flagged with
// `mustResetPassword` is allowed to do.
//
// This is NOT "forgot my password": there is no email, no token, no way in
// without already knowing the current password. It is the second half of a
// handover — a SUPERADMIN gave someone a temporary password, and this is where
// that password stops being the one that opens the account.

export type ResetPasswordState = { error?: string };

const RESET_FAILED = "ตั้งรหัสผ่านใหม่ไม่สำเร็จ โปรดลองอีกครั้ง";

const schema = z
  .object({
    next: z
      .string()
      .min(MIN_PASSWORD_LENGTH, {
        message: `รหัสผ่านใหม่ต้องมีอย่างน้อย ${MIN_PASSWORD_LENGTH} ตัวอักษร`,
      })
      .max(MAX_PASSWORD_LENGTH, { message: "รหัสผ่านยาวเกินไป" }),
    confirm: z.string(),
  })
  .refine((v) => v.next === v.confirm, {
    message: "รหัสผ่านใหม่ทั้งสองช่องไม่ตรงกัน",
    path: ["confirm"],
  });

export async function resetPassword(
  _prev: ResetPasswordState,
  formData: FormData,
): Promise<ResetPasswordState> {
  // requireSession, not requireUser: this action is the way *out* of the flag,
  // so the guard that enforces the flag would bounce it in a loop.
  const user = await requireSession();

  // Nothing to reset — most likely a stale tab submitted after the real reset
  // finished in another one. Send them on instead of writing a second password.
  if (!needsPasswordReset(user)) redirect(ROLE_HOME[user.role]);

  const parsed = schema.safeParse({
    next: formData.get("next") ?? "",
    confirm: formData.get("confirm") ?? "",
  });
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "ข้อมูลไม่ถูกต้อง" };

  const { next } = parsed.data;

  try {
    const row = await prisma.user.findUnique({
      where: { id: user.id },
      select: { password: true },
    });
    if (!row) return { error: "ไม่พบบัญชีของคุณ" };

    // The whole point is to retire the temporary password. Keeping it would leave
    // the account open to whoever it was handed to — a chat message, an email, the
    // person standing at the next desk.
    if (row.password && (await verifyPassword(next, row.password))) {
      return { error: "รหัสผ่านใหม่ต้องไม่ซ้ำกับรหัสผ่านชั่วคราวที่ได้รับมา" };
    }

    await prisma.user.update({
      where: { id: user.id },
      data: { password: await hashPassword(next), mustResetPassword: false },
    });

    // Everything issued under the temporary password goes, including this one —
    // then a fresh session for the browser that just did the work. Order matters:
    // issuing first would delete the new row along with the old.
    //
    // Always PASSWORD here, unlike F25's change-password: `needsPasswordReset()`
    // has already established that this session is a password session.
    await revokeAllSessions(user.id);
    await createSession(user.id, "PASSWORD");

    await logActivity(user, "profile.password_reset", {
      detail: "ตั้งรหัสผ่านใหม่ตามที่ระบบบังคับ",
    });
  } catch (error) {
    console.error("[reset-password] resetPassword failed", error);
    return { error: RESET_FAILED };
  }

  // redirect() throws — keep it out of any try/catch.
  redirect(ROLE_HOME[user.role]);
}
