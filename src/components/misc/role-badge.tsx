import type { AppRole } from "@/generated/prisma/enums";
import { cn } from "@/lib/utils";

// Enum values stay English; only these labels are Thai (CLAUDE.md § Language).
const LABELS: Record<AppRole, string> = {
  SUPERADMIN: "ผู้ดูแลสูงสุด",
  ADMIN: "เจ้าหน้าที่",
  USER: "ผู้ใช้ทั่วไป",
};

const STYLES: Record<AppRole, string> = {
  SUPERADMIN: "bg-purple-100 text-purple-700 dark:bg-purple-500/20 dark:text-purple-300",
  ADMIN: "bg-blue-100 text-blue-700 dark:bg-blue-500/20 dark:text-blue-300",
  USER: "bg-gray-100 text-gray-700 dark:bg-gray-500/20 dark:text-gray-300",
};

export function RoleBadge({ role, className }: { role: AppRole; className?: string }) {
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium",
        STYLES[role],
        className,
      )}
    >
      {LABELS[role]}
    </span>
  );
}
