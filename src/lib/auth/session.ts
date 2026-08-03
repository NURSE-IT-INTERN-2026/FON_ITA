import { cookies } from "next/headers";
import { cache } from "react";
import type { AppRole, LoginMethod } from "@/generated/prisma/enums";
import { prisma } from "@/lib/prisma";
import {
  SESSION_COOKIE_NAME,
  SESSION_COOKIE_PATH,
  SESSION_COOKIE_SAMESITE,
} from "@/lib/auth/session-cookie";
import {
  generateSessionToken,
  getSessionExpiry,
  hashSessionToken,
} from "@/lib/auth/session-token";

/**
 * The signed-in user, read fresh from the database on every request.
 * Superset of `ShellUser`, so it can be passed straight to the shell components.
 */
export type SessionUser = {
  id: number;
  email: string;
  cmuAccount: string;
  prefix: string | null;
  firstname: string;
  lastname: string;
  role: AppRole;
  mustResetPassword: boolean;
  /**
   * How *this* session was started. Carried here because the forced-reset gate
   * (F34) has to tell the two channels apart: `mustResetPassword` is about the
   * stored password, and a CMU OAuth session never touched it.
   */
  loginMethod: LoginMethod;
};

/**
 * Start a session and set the cookie.
 *
 * Only callable from a Server Action or Route Handler — Next.js forbids writing
 * cookies while rendering a Server Component.
 */
export async function createSession(
  userId: number,
  loginMethod: LoginMethod = "PASSWORD",
): Promise<void> {
  const token = generateSessionToken();
  const expiresAt = getSessionExpiry();

  await prisma.session.create({
    data: { id: hashSessionToken(token), userId, expiresAt, loginMethod },
  });

  const cookieStore = await cookies();
  cookieStore.set(SESSION_COOKIE_NAME, token, {
    httpOnly: true,
    sameSite: SESSION_COOKIE_SAMESITE,
    secure: process.env.NODE_ENV === "production",
    path: SESSION_COOKIE_PATH,
    expires: expiresAt,
  });
}

/**
 * Resolve the current user, or null. Safe to call anywhere on the server.
 *
 * One DB read per request, by design (decisions.md D2): it is what makes
 * "log out everywhere" and disabling an account take effect immediately.
 *
 * Wrapped in React `cache()` so a layout and its page — which both guard
 * themselves — share a single query per request instead of repeating it.
 */
export const getSessionUser = cache(async (): Promise<SessionUser | null> => {
  const cookieStore = await cookies();
  const token = cookieStore.get(SESSION_COOKIE_NAME)?.value;
  if (!token) return null;

  // findFirst, not findUnique — `expiresAt` is not part of a unique constraint,
  // so findUnique rejects it in the where clause. Filtering here (rather than
  // after the read) means an expired row can never match.
  const session = await prisma.session.findFirst({
    where: { id: hashSessionToken(token), expiresAt: { gt: new Date() } },
    include: { user: true },
  });

  // `status: false` = ปิดใช้งาน. Checked on every request so disabling an account
  // locks it out at once instead of waiting ~30 days for the session to expire.
  if (!session?.user || !session.user.status) return null;

  const { user } = session;
  return {
    id: user.id,
    email: user.email,
    cmuAccount: user.cmuAccount,
    prefix: user.prefix,
    firstname: user.firstname,
    lastname: user.lastname,
    role: user.role,
    mustResetPassword: user.mustResetPassword,
    loginMethod: session.loginMethod,
  };
});

/**
 * Log out: delete the row first, then the cookie.
 *
 * Deleting only the cookie would leave a working session for anyone who copied
 * it. Server Action / Route Handler only, same as `createSession`.
 */
export async function clearSession(): Promise<LoginMethod | null> {
  const cookieStore = await cookies();
  const token = cookieStore.get(SESSION_COOKIE_NAME)?.value;
  let loginMethod: LoginMethod | null = null;

  if (token) {
    const id = hashSessionToken(token);
    // Read the method before deleting — the caller needs it to decide whether
    // logout must also bounce through the identity provider.
    loginMethod = (await prisma.session.findUnique({ where: { id } }))?.loginMethod ?? null;
    // deleteMany, not delete — a stale or forged cookie must not throw on logout.
    await prisma.session.deleteMany({ where: { id } });
  }

  cookieStore.delete({ name: SESSION_COOKIE_NAME, path: SESSION_COOKIE_PATH });
  return loginMethod;
}

/**
 * How the current session was started, or null when there is none.
 *
 * Used when a session has to be re-issued in place (F25 changes a password and
 * revokes everything, including the caller's own row). Without this the new
 * session would default to PASSWORD, and logging out of what began as a CMU
 * login would stop clearing the Microsoft session.
 */
export async function getSessionLoginMethod(): Promise<LoginMethod | null> {
  const cookieStore = await cookies();
  const token = cookieStore.get(SESSION_COOKIE_NAME)?.value;
  if (!token) return null;

  const session = await prisma.session.findUnique({
    where: { id: hashSessionToken(token) },
    select: { loginMethod: true },
  });
  return session?.loginMethod ?? null;
}

/** Log out everywhere. Call after a password change or a role/status change. */
export async function revokeAllSessions(userId: number): Promise<number> {
  const { count } = await prisma.session.deleteMany({ where: { userId } });
  return count;
}

/** Housekeeping — expired rows are never returned but still accumulate. */
export async function deleteExpiredSessions(): Promise<number> {
  const { count } = await prisma.session.deleteMany({
    where: { expiresAt: { lt: new Date() } },
  });
  return count;
}
