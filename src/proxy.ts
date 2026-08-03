import { NextResponse, type NextRequest } from "next/server";
import { SESSION_COOKIE_NAME } from "@/lib/auth/session-cookie";
import { withBasePath } from "@/lib/base-path";

/**
 * Route protection — the FIRST gate only (docs/rules/route-map.md).
 *
 * Reading ITA/OIT content needs no session (decisions.md D12): the data is
 * published transparency information, and the app is the place people read it.
 * Visitors read it on `/` and on `/ita-oit/[id]`; the ITA *list* screens are
 * the staff working view (D12 amendment) and are gated.
 * A session is only needed to change something or to reach a staff-only page.
 *
 * This checks that a session cookie is *present*, nothing more. It does not
 * validate the token, look up the row, or read the role: Next.js documents the
 * proxy as an optimistic check and explicitly not a session/authorization
 * solution, and a DB round-trip here would run on every navigation on top of
 * the one the page already does.
 *
 * The real decision happens at the page / Server Action via getSessionUser()
 * and the RBAC helpers (F11) — a forged or expired cookie gets past this file
 * by design and is rejected there.
 */

// Paths reachable without a session. Whitelist, never blacklist: a new route is
// gated until it is listed here, so forgetting one fails closed.
//
// These are matched WITHOUT the basePath — Next.js strips /fonita before the
// proxy runs. Writing "/fonita/login" here would silently never match and leave
// every guarded route open.
const PUBLIC_PREFIXES = [
  "/", // landing page — where visitors read ITA/OIT (search + accordion)
  // NOT "/ita-list" or "/ita": those are the staff working view (drag to
  // reorder, add OIT, edit/delete). A visitor gets nothing there that the
  // landing page does not already give them. See decisions.md D12 amendment.
  "/ita-oit", // OIT detail — the shareable URL. NOT /create and /edit, below
  "/login", // form login page
  "/api/auth", // /cmu, /callback, /logout — the login flow itself
  "/api/v1", // Public API (FROZEN) — consumed by the faculty website
  "/api/nurse", // Public API — YouTube feed proxy
  "/storage", // file serving (F22 does its own checks)
  "/cmu-mobile", // SCMC one-time-token callback
];

/**
 * Carved out of the public prefixes above. `/ita-oit` is public for reading, so
 * without this the editor routes underneath it would inherit that and open up.
 * Listed longest-first is not enough — these are checked BEFORE the public list.
 */
const PRIVATE_EXCEPTIONS = ["/ita-oit/create", "/ita-oit/edit"];

/**
 * Prefix matching has to stop at a segment boundary: a bare
 * `startsWith("/login")` would also make "/login-history" public.
 */
function matches(pathname: string, prefix: string): boolean {
  // "/" would otherwise prefix-match every path in the app.
  if (prefix === "/") return pathname === "/";
  return pathname === prefix || pathname.startsWith(`${prefix}/`);
}

function isPublicPath(pathname: string): boolean {
  if (PRIVATE_EXCEPTIONS.some((p) => matches(pathname, p))) return false;
  return PUBLIC_PREFIXES.some((p) => matches(pathname, p));
}

export function proxy(request: NextRequest): NextResponse {
  const { pathname } = request.nextUrl;

  if (isPublicPath(pathname)) return NextResponse.next();
  if (request.cookies.get(SESSION_COOKIE_NAME)?.value) return NextResponse.next();

  // NextResponse.redirect replaces the whole pathname, basePath included, so it
  // has to be added back explicitly — unlike redirect() in a Server Action.
  const loginUrl = new URL(withBasePath("/login"), request.url);

  // Remember where they were headed so login can send them back. `pathname` has
  // no basePath, which is exactly what the Server Action redirect() expects.
  // It is echoed through a query string and a hidden field, so the login action
  // re-validates it with getSafeRedirectPath() rather than trusting it.
  loginUrl.searchParams.set("next", `${pathname}${request.nextUrl.search}`);

  return NextResponse.redirect(loginUrl);
}

export const config = {
  // Without a matcher the proxy also runs for CSS, JS and images, and the
  // redirect above would break them while signed out. Excludes Next.js internals
  // and anything with a file extension (public/ assets such as nurse-th.png).
  //
  // "/" is listed separately: the capture group below is a path-to-regexp
  // segment and does not match an empty one, so the dashboard at "/" would
  // otherwise be left unguarded. Verified — it 200'd without a session before
  // this line was added.
  matcher: ["/", "/((?!_next/static|_next/image|favicon.ico|.*\\.[\\w]+$).*)"],
};
