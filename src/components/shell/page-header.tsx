import { ChevronRight } from "lucide-react";
import Link from "next/link";
import type { ReactNode } from "react";
import { featuredSurfaceClass } from "@/components/shell/surface-styles";
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
          ? `${featuredSurfaceClass} px-5 py-5 sm:px-6`
          : "border-b pb-4",
      )}
    >
      <div className="min-w-0">
        {breadcrumb && breadcrumb.length > 0 && (
          <nav
            aria-label="เส้นทางนำทาง"
            className={cn(
              "mb-1 flex items-center gap-1 text-xs",
              variant === "featured" ? "text-warm" : "text-muted-foreground",
            )}
          >
            {breadcrumb.map((c, i) => (
              <span key={`${c.label}-${i}`} className="flex items-center gap-1">
                {c.href ? (
                  <Link
                    href={c.href}
                    className={cn(
                      "transition-colors hover:text-foreground",
                      variant === "featured" && "hover:text-warm-strong dark:hover:text-warm",
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
            variant === "featured" && "text-warm-strong dark:text-warm",
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
