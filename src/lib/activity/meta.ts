import {
  FileText,
  Files,
  LogIn,
  LogOut,
  type LucideIcon,
  ShieldCheck,
  UserCog,
  Users,
} from "lucide-react";
import { actionLabel } from "@/lib/activity/actions";

export const ACTIVITY_CATEGORIES = [
  { value: "auth", label: "การเข้าสู่ระบบ" },
  { value: "ita_oit", label: "ITA / OIT" },
  { value: "file", label: "คลังไฟล์" },
  { value: "user", label: "ผู้ใช้" },
  { value: "profile", label: "โปรไฟล์" },
] as const;

export type ActivityCategory = (typeof ACTIVITY_CATEGORIES)[number]["value"];

type ActivityMeta = {
  label: string;
  icon: LucideIcon;
  chipClassName: string;
};

const META_BY_PREFIX: Array<{
  match: (action: string) => boolean;
  icon: LucideIcon;
  chipClassName: string;
}> = [
  {
    match: (action) => action === "login",
    icon: LogIn,
    chipClassName:
      "border-amber-200 bg-amber-50 text-amber-700 dark:border-amber-900/60 dark:bg-amber-950/40 dark:text-amber-300",
  },
  {
    match: (action) => action === "logout",
    icon: LogOut,
    chipClassName:
      "border-amber-200 bg-amber-50 text-amber-700 dark:border-amber-900/60 dark:bg-amber-950/40 dark:text-amber-300",
  },
  {
    match: (action) => action.startsWith("ita.") || action.startsWith("oit."),
    icon: FileText,
    chipClassName:
      "border-orange-200 bg-orange-50 text-orange-700 dark:border-orange-900/60 dark:bg-orange-950/40 dark:text-orange-300",
  },
  {
    match: (action) => action.startsWith("file."),
    icon: Files,
    chipClassName:
      "border-stone-200 bg-stone-50 text-stone-700 dark:border-stone-800 dark:bg-stone-900/50 dark:text-stone-300",
  },
  {
    match: (action) => action.startsWith("user."),
    icon: Users,
    chipClassName:
      "border-rose-200 bg-rose-50 text-rose-700 dark:border-rose-900/60 dark:bg-rose-950/40 dark:text-rose-300",
  },
  {
    match: (action) => action.startsWith("profile."),
    icon: UserCog,
    chipClassName:
      "border-rose-200 bg-rose-50 text-rose-700 dark:border-rose-900/60 dark:bg-rose-950/40 dark:text-rose-300",
  },
];

const FALLBACK_META = {
  icon: ShieldCheck,
  chipClassName:
    "border-border bg-muted/40 text-muted-foreground dark:bg-muted/30",
} satisfies Omit<ActivityMeta, "label">;

export function categoryLabel(category: ActivityCategory): string {
  return ACTIVITY_CATEGORIES.find((item) => item.value === category)?.label ?? category;
}

export function categoryForAction(action: string): ActivityCategory | undefined {
  if (action === "login" || action === "logout") return "auth";
  if (action.startsWith("ita.") || action.startsWith("oit.")) return "ita_oit";
  if (action.startsWith("file.")) return "file";
  if (action.startsWith("user.")) return "user";
  if (action.startsWith("profile.")) return "profile";

  return undefined;
}

export function getActivityMeta(action: string): ActivityMeta {
  const match = META_BY_PREFIX.find((item) => item.match(action));

  return {
    label: actionLabel(action),
    icon: match?.icon ?? FALLBACK_META.icon,
    chipClassName: match?.chipClassName ?? FALLBACK_META.chipClassName,
  };
}