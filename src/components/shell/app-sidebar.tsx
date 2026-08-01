"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { currentBEYear } from "@/lib/date";
import { cn } from "@/lib/utils";
import { isActivePath, visibleNavLinks, type ShellUser } from "@/components/shell/nav";

export function AppSidebar({
  user,
  onNavigate,
}: {
  user: ShellUser | null;
  onNavigate?: () => void;
}) {
  // usePathname() already has the basePath stripped, matching NAV_LINKS.
  const pathname = usePathname();
  const links = visibleNavLinks(user);

  return (
    <aside className="flex h-full w-full flex-col bg-sidebar text-sidebar-foreground">
      <div className="flex items-center gap-2 border-b border-sidebar-border px-5 py-4">
        <p className="truncate text-sm font-bold tracking-tight">ระบบข้อมูลสาธารณะ</p>
      </div>

      <nav aria-label="เมนูหลัก" className="flex-1 space-y-1 overflow-y-auto p-3">
        {links.map((l) => {
          const active = isActivePath(pathname, l);
          const Icon = l.icon;
          return (
            <Link
              key={l.href}
              href={l.href}
              onClick={onNavigate}
              aria-current={active ? "page" : undefined}
              className={cn(
                "flex items-center gap-3 rounded-md px-4 py-2 text-sm font-medium transition-colors",
                active
                  ? "bg-sidebar-primary text-sidebar-primary-foreground"
                  : "hover:bg-sidebar-accent hover:text-sidebar-accent-foreground",
              )}
            >
              <Icon className="h-4 w-4 shrink-0" aria-hidden />
              <span className="truncate">{l.label}</span>
            </Link>
          );
        })}
      </nav>

      <div className="border-t border-sidebar-border p-4 text-[11px] text-muted-foreground">
        © {currentBEYear()} คณะพยาบาลศาสตร์ มช.
      </div>
    </aside>
  );
}
