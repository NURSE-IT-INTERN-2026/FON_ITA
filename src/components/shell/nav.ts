import { FolderOpen, History, Home, ListChecks, Users, type LucideIcon } from "lucide-react";
import type { AppRole } from "@/generated/prisma/enums";

/**
 * The subset of the signed-in user the shell needs.
 * `null` means nobody is signed in — the shell renders its public form. Inside
 * the (app) group `requireUser()` guarantees a user, but the header is also
 * usable on public pages, so the type stays nullable.
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
  /** roles allowed to see the link; omitted means everyone, signed in or not */
  roles?: AppRole[];
};

// Paths and roles follow docs/rules/route-map.md and the role matrix in
// docs/specs/_features.md — /ita-list per decisions.md D9.
export const NAV_LINKS: NavLink[] = [
  { href: "/", label: "หน้าแรก", icon: Home, exact: true },
  { href: "/ita-list", label: "รายการ ITA", icon: ListChecks },
  { href: "/ita-file", label: "คลังไฟล์", icon: FolderOpen, roles: ["ADMIN", "SUPERADMIN"] },
  { href: "/user-management", label: "จัดการผู้ใช้", icon: Users, roles: ["SUPERADMIN"] },
  { href: "/activity-log", label: "บันทึกกิจกรรม", icon: History, roles: ["SUPERADMIN"] },
];

/**
 * Links for the current visitor. Anonymous visitors get the public ones
 * (decisions.md D12) rather than an empty bar — reading ITA/OIT is what most
 * people come here for and needs no account.
 */
export function visibleNavLinks(user: ShellUser | null): NavLink[] {
  return NAV_LINKS.filter((l) => (user ? !l.roles || l.roles.includes(user.role) : !l.roles));
}

/**
 * `startsWith` alone would light up "/ita-list" while on "/ita-list-archive",
 * so a prefix match must stop at a segment boundary.
 */
export function isActivePath(pathname: string, link: NavLink): boolean {
  if (link.exact) return pathname === link.href;
  return pathname === link.href || pathname.startsWith(`${link.href}/`);
}
