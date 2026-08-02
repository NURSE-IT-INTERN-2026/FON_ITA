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
