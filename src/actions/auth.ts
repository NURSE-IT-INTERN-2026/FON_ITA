"use server";

import { redirect } from "next/navigation";
import { z } from "zod";
import { logActivity } from "@/lib/activity/log";
import { RESET_PASSWORD_PATH } from "@/lib/auth/guards";
import { fakeVerifyDelay, verifyPassword } from "@/lib/auth/password";
import { getSafeRedirectPath } from "@/lib/auth/roles";
import { createSession } from "@/lib/auth/session";
import { prisma } from "@/lib/prisma";

// Same message whether the account does not exist or the password is wrong, so
// the form cannot be used to discover which emails are registered.
const INVALID_CREDENTIALS = "อีเมลหรือรหัสผ่านไม่ถูกต้อง";

const loginSchema = z.object({
  // Trim/lowercase BEFORE validating — `z.email().trim()` checks the format
  // first, so an address pasted with a trailing space is rejected as a malformed
  // email. Lowercased because Postgres compares text case-sensitively (see
  // prisma/seed.ts); user creation (F24) normalises the same way.
  email: z.string().trim().toLowerCase().pipe(z.email({ message: "รูปแบบอีเมลไม่ถูกต้อง" })),
  password: z.string().min(1, { message: "กรุณากรอกรหัสผ่าน" }),
  // Hidden field carrying the page the proxy interrupted. Never trusted as-is —
  // getSafeRedirectPath() decides whether it is usable for this role.
  next: z.string().optional(),
});

export type LoginState = { error?: string };

export async function authenticate(
  _prev: LoginState,
  formData: FormData,
): Promise<LoginState> {
  const parsed = loginSchema.safeParse({
    email: formData.get("email"),
    password: formData.get("password"),
    next: formData.get("next") ?? undefined,
  });

  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? INVALID_CREDENTIALS };
  }

  const { email, password, next } = parsed.data;
  const user = await prisma.user.findUnique({ where: { email } });

  if (!user) {
    // Burn comparable time so "no such account" is not measurably faster than
    // "wrong password" — otherwise the response time leaks which emails exist.
    await fakeVerifyDelay();
    return { error: INVALID_CREDENTIALS };
  }

  if (!(await verifyPassword(password, user.password))) {
    return { error: INVALID_CREDENTIALS };
  }

  // Past this point the caller has proven they own the account, so a specific
  // reason reveals nothing they did not already know.
  if (!user.status) {
    return { error: "บัญชีนี้ถูกปิดใช้งาน โปรดติดต่อผู้ดูแลระบบ" };
  }

  await createSession(user.id);
  // Only successful logins are recorded. A failed attempt would be worth having,
  // but the log is readable by SUPERADMIN and a mistyped password lands in the
  // email field often enough that storing the attempts is its own risk.
  await logActivity(user, "login", { detail: "อีเมล + รหัสผ่าน" });

  // A password marked as temporary gets a session — they proved they own the
  // account — but the session cannot go anywhere else: requireUser() sends every
  // guarded page and action back here until the flag is cleared (F34). Handing
  // out a session rather than refusing the login is what makes the reset
  // reachable at all; before this, the flag simply locked people out.
  if (user.mustResetPassword) redirect(RESET_PASSWORD_PATH);

  // redirect() throws — it must stay outside any try/catch.
  // Back to the interrupted page, or the role's home if `next` is missing,
  // off-site, or not a path this role may reach. No basePath here: redirect()
  // in a Server Action adds it.
  redirect(getSafeRedirectPath(user.role, next));
}
