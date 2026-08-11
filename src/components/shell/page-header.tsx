import { ChevronRight } from "lucide-react";
import Link from "next/link";
import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

export type Crumb = {
  label: string;
  /** omit for the current page — renders as plain text */
  href?: string;
};

export function PageHeader({
  title,
  breadcrumb,
  actions,
  description,
  variant = "default",
}: {
  title: string;
  breadcrumb?: Crumb[];
  actions?: ReactNode;
  description?: string;
  variant?: "default" | "featured";
}) {
  return (
    <div
      className={cn(
        "mb-6 flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between",
        variant === "featured"
          ? "rounded-[28px] border border-stone-200/80 bg-white px-5 py-5 shadow-[0_24px_60px_-52px_rgba(67,36,19,0.4)] dark:border-border/80 dark:bg-card/95 dark:shadow-[0_26px_70px_-48px_rgba(0,0,0,0.72)] sm:px-6"
          : "border-b pb-4",
      )}
    >
      <div className="min-w-0">
        {breadcrumb && breadcrumb.length > 0 && (
          <nav
            aria-label="เส้นทางนำทาง"
            className={cn(
              "mb-1 flex items-center gap-1 text-xs",
              variant === "featured" ? "text-[#9b6a46] dark:text-primary/80" : "text-muted-foreground",
            )}
          >
            {breadcrumb.map((c, i) => (
              <span key={`${c.label}-${i}`} className="flex items-center gap-1">
                {c.href ? (
                  <Link
                    href={c.href}
                    className={cn(
                      "transition-colors hover:text-foreground",
                      variant === "featured" && "hover:text-[#4d1646] dark:hover:text-primary",
                    )}
                  >
                    {c.label}
                  </Link>
                ) : (
                  <span aria-current="page">{c.label}</span>
                )}
                {i < breadcrumb.length - 1 && <ChevronRight className="h-3 w-3" aria-hidden />}
              </span>
            ))}
          </nav>
        )}
        <h1
          className={cn(
            "truncate text-2xl font-bold tracking-tight",
            variant === "featured" && "text-[#4d1646] dark:text-foreground",
          )}
        >
          {title}
        </h1>
        {description && (
          <p
            className={cn(
              "mt-1 text-sm",
              variant === "featured" ? "text-muted-foreground sm:max-w-3xl" : "text-muted-foreground",
            )}
          >
            {description}
          </p>
        )}
      </div>
      {actions && <div className="flex shrink-0 flex-wrap items-center gap-2">{actions}</div>}
    </div>
  );
}
