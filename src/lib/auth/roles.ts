import type { AppRole } from "@/generated/prisma/enums";

// Pure RBAC policy — no cookies, no database, no `node:crypto`. Safe to import
// from anywhere, including Client Components and proxy.ts.
// Source: docs/rules/route-map.md + the role matrix in docs/chapters/03-auth-rbac.md.

/**
 * Where each role lands after login, and the fallback when a `?next=` target is
 * rejected. Every role shares one home today; the map exists so the roles can
 * diverge later without hunting down redirect targets.
 */
export const ROLE_HOME: Record<AppRole, string> = {
  SUPERADMIN: "/ita-list",
  ADMIN: "/ita-list",
  USER: "/ita-list",
};

// Whitelist, never blacklist: a route that nobody remembered to list is denied,
// which fails closed instead of leaking.
const USER_PREFIXES = ["/", "/ita-list", "/ita", "/ita-oit", "/ita-file", "/profile"];
const ADMIN_PREFIXES = [...USER_PREFIXES, "/activity-log"];
const SUPERADMIN_PREFIXES = [...ADMIN_PREFIXES, "/user-management"];

/**
 * Path prefixes each role may navigate to.
 *
 * The hierarchy is written out by composing the arrays — enum order does not
 * imply it, and relying on that would break the moment a role is added.
 */
const ROLE_ALLOWED_PREFIXES: Record<AppRole, string[]> = {
  USER: USER_PREFIXES,
  ADMIN: ADMIN_PREFIXES,
  SUPERADMIN: SUPERADMIN_PREFIXES,
};

/**
 * A prefix must stop at a segment boundary, or "/ita" would also match
 * "/ita-list" and "/ita-file". "/" is exact-only — as a prefix it would match
 * every path and make the whitelist meaningless.
 */
function matchesPrefix(pathname: string, prefix: string): boolean {
  if (prefix === "/") return pathname === "/";
  return pathname === prefix || pathname.startsWith(`${prefix}/`);
}

/**
 * Navigation-level check: may this role reach this path at all?
 *
 * Deliberately coarse — it cannot express "/ita-oit/create is ADMIN+ while
 * /ita-oit/[id] is USER+". That granularity belongs to the page's own
 * `requireRole()` call, which is the real decision. This function only decides
 * where to send someone, never whether they may act.
 */
export function canAccess(role: AppRole, pathname: string): boolean {
  return ROLE_ALLOWED_PREFIXES[role].some((p) => matchesPrefix(pathname, p));
}

/** Role check for rendering — hiding a control is UX, not authorization. */
export function hasRole(
  user: { role: AppRole } | null | undefined,
  ...allowed: AppRole[]
): boolean {
  return !!user && allowed.includes(user.role);
}

/**
 * Validate a `?next=` target before redirecting to it.
 *
 * The value reaches us through a query string and a hidden form field, so it is
 * user input: without this, `?next=https://evil.example` turns the login page
 * into an open redirect.
 */
export function getSafeRedirectPath(
  role: AppRole,
  nextPath: string | null | undefined,
): string {
  const fallback = ROLE_HOME[role];
  if (!nextPath) return fallback;

  // Must be one rooted path. "//host" is protocol-relative (a real off-site
  // redirect), and browsers normalise the backslash in "/\evil.example" to a
  // second slash, so both have to go.
  if (!nextPath.startsWith("/") || nextPath.startsWith("//") || nextPath.includes("\\")) {
    return fallback;
  }

  // Query and hash ride along untouched — only the path decides access.
  const pathname = nextPath.split(/[?#]/)[0];
  return canAccess(role, pathname) ? nextPath : fallback;
}
