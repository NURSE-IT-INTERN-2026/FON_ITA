import { cookies } from "next/headers";
import { forbidden, redirect, unauthorized } from "next/navigation";
import type { AppRole } from "@/generated/prisma/enums";
import { SESSION_COOKIE_NAME } from "@/lib/auth/session-cookie";
import { getSessionUser, type SessionUser } from "@/lib/auth/session";

// Server-side guards — the gate that actually decides (docs/rules/decisions.md
// D11). proxy.ts only checks that a cookie exists; these read the session row,
// so a forged, expired, or revoked cookie stops here.
//
// Server Components, Server Actions and Route Handlers only: getSessionUser()
// reads cookies and cannot run in a Client Component. Neither interrupt may be
// called from the ROOT layout — src/app/(app)/layout.tsx is a child layout, so
// calling requireUser() there is fine.

/**
 * Require a signed-in user.
 *
 * Two outcomes, because the two situations are not the same:
 * - **no cookie at all** → straight to the login form. proxy.ts normally catches
 *   this first (with `?next=`); this branch is the safety net for a path its
 *   matcher misses, so it keeps the same behaviour.
 * - **cookie present but not a valid session** → 401 `unauthorized()`, which
 *   tells the user their session ended rather than silently showing a login form
 *   they thought they had already filled in.
 *
 * Both throw, so this either returns a real user or never returns — callers need
 * no null check. Keep it out of any try/catch or the interrupt gets swallowed.
 */
export async function requireUser(): Promise<SessionUser> {
  const user = await requireSession();
  if (needsPasswordReset(user)) redirect(RESET_PASSWORD_PATH);
  return user;
}

/** Where a flagged account is sent, and the one page `requireUser()` cannot guard. */
export const RESET_PASSWORD_PATH = "/reset-password";

/**
 * Must this session set a new password before it may do anything else? (F34)
 *
 * Only for sessions started with a password. `mustResetPassword` marks the
 * stored hash as one nobody should keep using — a temporary password a
 * SUPERADMIN handed over, or a legacy bcrypt hash from the MySQL migration.
 * A CMU OAuth session never presented that hash, and a CMU-only account is
 * allowed to have no password at all (D7), so forcing one there would demand a
 * credential the account does not want.
 */
export function needsPasswordReset(user: SessionUser): boolean {
  return user.mustResetPassword && user.loginMethod === "PASSWORD";
}

/**
 * A valid session, with **no** forced-reset check.
 *
 * Exists only for the reset page and its action: they are what clears the flag,
 * so routing them through `requireUser()` would redirect them to themselves
 * forever. Nothing else should call this — using it elsewhere reopens the
 * account that the flag was meant to hold shut.
 */
export async function requireSession(): Promise<SessionUser> {
  const user = await getSessionUser();
  if (user) return user;

  const cookieStore = await cookies();
  if (!cookieStore.get(SESSION_COOKIE_NAME)?.value) redirect("/login");

  unauthorized();
}

/**
 * Require one of `allowed`. Not signed in → as above; signed in with the wrong
 * role → 403 `forbidden()`, because bouncing them somewhere else would hide the
 * fact that the page exists but is not theirs.
 *
 * Call it in the page AND in every Server Action behind it — they are separate
 * entry points, and an action can be invoked without the page ever rendering.
 */
export async function requireRole(...allowed: AppRole[]): Promise<SessionUser> {
  const user = await requireUser();
  if (!allowed.includes(user.role)) forbidden();
  return user;
}

/**
 * The same decision as `requireRole()`, but as a value instead of an interrupt.
 *
 * Server Actions are its callers: a form action must return its refusal as
 * `{ error }` for the dialog to display, not raise `forbidden()`. Signing out
 * mid-session still interrupts via `requireUser()` underneath — only the
 * wrong-role outcome becomes null.
 */
export async function getActorIfRole(
  ...allowed: AppRole[]
): Promise<SessionUser | null> {
  const user = await requireUser();
  return allowed.includes(user.role) ? user : null;
}
