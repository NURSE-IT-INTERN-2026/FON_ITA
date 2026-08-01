"use client";

import { LogIn, LogOut, Menu, User as UserIcon } from "lucide-react";
import Image from "next/image";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Sheet, SheetContent, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
// Static import, not src="/nurse-th.png": with a basePath set, the optimizer
// fetches the string form without the prefix and 404s. A static import is
// resolved at build time instead, so it works under any basePath.
import nurseLogo from "@/../public/nurse-th.png";
import { AppSidebar } from "@/components/shell/app-sidebar";
import { ThemeToggle } from "@/components/shell/theme-toggle";
import { isActivePath, visibleNavLinks, type ShellUser } from "@/components/shell/nav";
import { RoleBadge } from "@/components/misc/role-badge";
import { withBasePath } from "@/lib/base-path";
import { cn } from "@/lib/utils";

export function AppHeader({ user }: { user: ShellUser | null }) {
  const pathname = usePathname();
  const [menuOpen, setMenuOpen] = useState(false);

  const links = visibleNavLinks(user);
  const initials = user ? `${user.firstname.at(0) ?? ""}${user.lastname.at(0) ?? ""}` : "";

  return (
    <header className="sticky top-0 z-30 flex h-16 items-stretch gap-2 border-b bg-background/90 px-4 backdrop-blur">
      {/* Left: mobile menu + brand */}
      <div className="flex min-w-0 flex-1 items-center gap-2">
        {links.length > 0 && (
          <Sheet open={menuOpen} onOpenChange={setMenuOpen}>
            <SheetTrigger asChild>
              <Button variant="ghost" size="icon" className="min-[1000px]:hidden" aria-label="เปิดเมนู">
                <Menu className="h-5 w-5" aria-hidden />
              </Button>
            </SheetTrigger>
            <SheetContent side="left" className="w-64 p-0">
              <SheetTitle className="sr-only">เมนูนำทาง</SheetTitle>
              <AppSidebar user={user} onNavigate={() => setMenuOpen(false)} />
            </SheetContent>
          </Sheet>
        )}

        <Link href="/" className="flex min-w-0 items-center gap-2">
          <Image
            src={nurseLogo}
            alt="ตราสัญลักษณ์คณะพยาบาลศาสตร์ มหาวิทยาลัยเชียงใหม่"
            width={56}
            height={56}
            priority
            className="size-10 shrink-0 object-contain sm:size-12 min-[1000px]:size-14"
          />
          <div className="flex min-w-0 flex-col leading-tight">
            <span className="whitespace-nowrap text-xs font-bold tracking-tight sm:text-sm min-[1000px]:text-base">
              คณะพยาบาลศาสตร์
            </span>
            <span className="whitespace-nowrap text-[10px] font-medium text-muted-foreground sm:text-[11px]">
              มหาวิทยาลัยเชียงใหม่
            </span>
          </div>
        </Link>
      </div>

      {/* Centre: desktop nav */}
      {links.length > 0 && (
        <nav aria-label="เมนูหลัก" className="hidden flex-none items-center gap-1 min-[1000px]:flex">
          {links.map((l) => {
            const active = isActivePath(pathname, l);
            const Icon = l.icon;
            return (
              <Link
                key={l.href}
                href={l.href}
                aria-current={active ? "page" : undefined}
                className={cn(
                  "relative inline-flex h-full items-center gap-1.5 px-3 text-sm font-medium transition-colors",
                  active ? "text-foreground" : "text-muted-foreground hover:text-foreground",
                )}
              >
                <Icon className="h-4 w-4" aria-hidden />
                <span>{l.label}</span>
                <span
                  aria-hidden
                  className={cn(
                    "absolute inset-x-2 bottom-0 h-0.5 rounded-full bg-primary transition-transform",
                    active ? "scale-x-100" : "scale-x-0",
                  )}
                />
              </Link>
            );
          })}
        </nav>
      )}

      {/* Right: theme + account */}
      <div className="flex flex-1 items-center justify-end gap-1">
        <ThemeToggle />

        {user ? (
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" className="h-10 gap-2 px-2">
                <Avatar className="h-8 w-8">
                  <AvatarFallback className="bg-primary text-primary-foreground text-xs">
                    {initials}
                  </AvatarFallback>
                </Avatar>
                <div className="hidden text-left sm:block">
                  <p className="text-xs font-medium leading-tight">
                    {[user.prefix, user.firstname, user.lastname].filter(Boolean).join(" ")}
                  </p>
                  <div className="mt-0.5">
                    <RoleBadge role={user.role} />
                  </div>
                </div>
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-56">
              <DropdownMenuLabel>บัญชีของฉัน</DropdownMenuLabel>
              <DropdownMenuSeparator />
              <DropdownMenuItem asChild>
                <Link href="/profile">
                  <UserIcon className="mr-2 h-4 w-4" aria-hidden />
                  โปรไฟล์
                </Link>
              </DropdownMenuItem>
              <DropdownMenuItem asChild>
                {/* Route handler, not a page — a plain <a> avoids <Link> prefetching
                    the URL and logging the user out on hover. Implemented in F9. */}
                <a href={withBasePath("/api/auth/logout")}>
                  <LogOut className="mr-2 h-4 w-4" aria-hidden />
                  ออกจากระบบ
                </a>
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        ) : (
          <Button asChild variant="outline" size="sm" className="gap-1.5">
            <Link href="/login">
              <LogIn className="h-4 w-4" aria-hidden />
              เข้าสู่ระบบ
            </Link>
          </Button>
        )}
      </div>
    </header>
  );
}
