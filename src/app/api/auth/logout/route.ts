import { NextResponse } from "next/server";
import { logActivity } from "@/lib/activity/log";
import { clearSession, getSessionUser } from "@/lib/auth/session";
import { withBasePath } from "@/lib/base-path";

/**
 * POST /api/auth/logout  (real path: /fonita/api/auth/logout)
 *
 * Deletes the Session row, clears the cookie, and lands on the login page.
 * Local-only by design (D25, amended 26 ส.ค. 2569): the Microsoft/Entra session
 * is deliberately left alone, so signing back in with CMU is one click. The
 * accepted trade-off is that on a shared machine the next person can re-enter
 * the same account until the Entra session expires.
 *
 * POST closes the forced-logout gap from the security review: with the session
 * cookie at SameSite=Lax, a cross-site top-level GET navigation can still send
 * the cookie, while a cross-site POST cannot.
 */
export async function POST(request: Request): Promise<NextResponse> {
  // Read who is leaving before the session row is gone — afterwards there is no
  // way to attribute the entry.
  const user = await getSessionUser();
  const loginMethod = await clearSession();
  if (user) {
    await logActivity(user, "logout", {
      detail: loginMethod === "CMU_OAUTH" ? "บัญชี CMU (OAuth)" : "อีเมล + รหัสผ่าน",
    });
  }

  // NextResponse.redirect replaces the whole pathname, so the basePath has to be
  // added explicitly here — unlike redirect() in a Server Action.
  return NextResponse.redirect(new URL(withBasePath("/login"), request.url));
}

export function GET(): NextResponse {
  return new NextResponse("Method Not Allowed", {
    status: 405,
    headers: { Allow: "POST" },
  });
}
