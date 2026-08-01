import { BookOpen } from "lucide-react";
import { currentBEYear } from "@/lib/date";
import type { ShellUser } from "@/components/shell/nav";

const VERSION = "v0.1.0";

/** Shown inside the app shell for signed-in staff. Hidden for plain USERs. */
export function AdminFooter({ user }: { user: ShellUser }) {
  return (
    <footer className="mt-8 flex flex-col gap-3 border-t pt-4 text-xs text-muted-foreground sm:flex-row sm:items-center sm:justify-between">
      <div className="flex flex-wrap items-center gap-2">
        <span>© {currentBEYear()} คณะพยาบาลศาสตร์ มช.</span>
        <span className="text-muted-foreground/50">·</span>
        <span className="font-mono">{VERSION}</span>
      </div>

      <div className="flex flex-wrap items-center gap-3">
        {(user.role === "ADMIN" || user.role === "SUPERADMIN") && (
          <span className="inline-flex items-center gap-1">
            <BookOpen className="h-3.5 w-3.5" aria-hidden />
            คู่มือแอดมิน (เร็ว ๆ นี้)
          </span>
        )}
      </div>
    </footer>
  );
}
