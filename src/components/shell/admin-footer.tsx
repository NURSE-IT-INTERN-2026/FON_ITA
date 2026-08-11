import pkg from "@/../package.json";
import { currentBEYear } from "@/lib/date";

const VERSION = `v${pkg.version}`;

/** Shown inside the app shell for signed-in staff. Hidden for plain USERs. */
export function AdminFooter() {
  return (
    <footer className="mt-8 flex flex-col gap-3 border-t pt-4 text-xs text-muted-foreground sm:flex-row sm:items-center sm:justify-between">
      <div className="flex flex-wrap items-center gap-2">
        <span>© {currentBEYear()} คณะพยาบาลศาสตร์ มช.</span>
        <span className="text-muted-foreground/50">·</span>
        <span>เวอร์ชัน</span>
        <span className="font-mono">{VERSION}</span>
      </div>
    </footer>
  );
}
