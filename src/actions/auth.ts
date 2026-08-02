"use server";

import { redirect } from "next/navigation";
import { z } from "zod";
import { fakeVerifyDelay, verifyPassword } from "@/lib/auth/password";
import { getSafeRedirectPath } from "@/lib/auth/roles";
import { createSession } from "@/lib/auth/session";
import { prisma } from "@/lib/prisma";

// Same message whether the account does not exist or the password is wrong, so
// the form cannot be used to discover which emails are registered.
const INVALID_CREDENTIALS = "อีเมลหรือรหัสผ่านไม่ถูกต้อง";

const loginSchema = z.object({
  // Lowercased because Postgres compares text case-sensitively — see prisma/seed.ts.
  // User creation (F24) must normalise the same way.
  email: z.email({ message: "รูปแบบอีเมลไม่ถูกต้อง" }).trim().toLowerCase(),
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

  if (user.mustResetPassword) {
    // TODO: replace with a redirect to the reset-password page once it exists.
    // Blocking here rather than redirecting avoids sending users to a 404.
    return { error: "บัญชีนี้ต้องตั้งรหัสผ่านใหม่ก่อนใช้งาน โปรดติดต่อผู้ดูแลระบบ" };
  }

  await createSession(user.id);

  // redirect() throws — it must stay outside any try/catch.
  // Back to the interrupted page, or the role's home if `next` is missing,
  // off-site, or not a path this role may reach. No basePath here: redirect()
  // in a Server Action adds it.
  redirect(getSafeRedirectPath(user.role, next));
}
