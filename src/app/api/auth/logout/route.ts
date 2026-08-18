import { NextResponse } from "next/server";
import { logActivity } from "@/lib/activity/log";
import { clearSession, getSessionUser } from "@/lib/auth/session";
import { withBasePath } from "@/lib/base-path";

/**
 * POST /api/auth/logout  (real path: /fonita/api/auth/logout)
 *
 * Deletes the Session row, clears the cookie, then sends the user back to the
 * login page — or through Microsoft first, if that is where the session came from.
 *
 * POST closes the forced-logout gap from the security review: with the session
 * cookie at SameSite=Lax, a cross-site top-level GET navigation can still send
 * the cookie, while a cross-site POST cannot. The provider logout leg remains a
 * redirect after the local session has already been cleared.
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
  const loginUrl = new URL(withBasePath("/login"), request.url);

  if (loginMethod !== "CMU_OAUTH") return NextResponse.redirect(loginUrl);

  // The local session is already gone. Clearing the CMU/Entra ID session too is
  // best-effort: without the endpoint configured, land on /login anyway rather
  // than fail the logout the user just asked for.
  const endSessionUrl = process.env.AUTH_URL?.replace("/authorize", "/logout");
  const postLogout = process.env.POST_LOGOUT_REDIRECT_URI || loginUrl.toString();
  if (!endSessionUrl) return NextResponse.redirect(loginUrl);

  const microsoftLogout = new URL(endSessionUrl);
  microsoftLogout.searchParams.set("post_logout_redirect_uri", postLogout);
  // Without a hint Microsoft shows an account picker when the browser holds
  // more than one Entra session — it cannot tell which one this app used.
  // The email (always @cmu.ac.th, D21) identifies it and skips that page.
  if (user) microsoftLogout.searchParams.set("logout_hint", user.email);
  return NextResponse.redirect(microsoftLogout);
}

export function GET(): NextResponse {
  return new NextResponse("Method Not Allowed", {
    status: 405,
    headers: { Allow: "POST" },
  });
}
