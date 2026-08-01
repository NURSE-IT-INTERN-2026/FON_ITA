import { FolderOpen, History, Home, ListChecks, Users, type LucideIcon } from "lucide-react";
import type { AppRole } from "@/generated/prisma/enums";

/**
 * The subset of the signed-in user the shell needs.
 * `null` means nobody is signed in — the shell renders its public form.
 * F5/F11 will supply this from `getSessionUser()`.
 */
export type ShellUser = {
  prefix: string | null;
  firstname: string;
  lastname: string;
  role: AppRole;
};

type NavLink = {
  href: string;
  label: string;
  icon: LucideIcon;
  /** match the path exactly instead of by prefix */
  exact?: boolean;
  /** roles allowed to see the link; omitted means every signed-in role */
  roles?: AppRole[];
};

// Paths and roles follow docs/rules/route-map.md and the role matrix in
// docs/specs/_features.md — /ita-list per decisions.md D9.
export const NAV_LINKS: NavLink[] = [
  { href: "/", label: "หน้าแรก", icon: Home, exact: true },
  { href: "/ita-list", label: "รายการ ITA", icon: ListChecks },
  { href: "/ita-file", label: "คลังไฟล์", icon: FolderOpen },
  { href: "/activity-log", label: "บันทึกกิจกรรม", icon: History, roles: ["ADMIN", "SUPERADMIN"] },
  { href: "/user-management", label: "จัดการผู้ใช้", icon: Users, roles: ["SUPERADMIN"] },
];

export function visibleNavLinks(user: ShellUser | null): NavLink[] {
  if (!user) return [];
  return NAV_LINKS.filter((l) => !l.roles || l.roles.includes(user.role));
}

/**
 * `startsWith` alone would light up "/ita-list" while on "/ita-list-archive",
 * so a prefix match must stop at a segment boundary.
 */
export function isActivePath(pathname: string, link: NavLink): boolean {
  if (link.exact) return pathname === link.href;
  return pathname === link.href || pathname.startsWith(`${link.href}/`);
}
