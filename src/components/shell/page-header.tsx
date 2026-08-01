import { ChevronRight } from "lucide-react";
import Link from "next/link";
import type { ReactNode } from "react";

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
}: {
  title: string;
  breadcrumb?: Crumb[];
  actions?: ReactNode;
  description?: string;
}) {
  return (
    <div className="mb-6 flex flex-col gap-3 border-b pb-4 sm:flex-row sm:items-end sm:justify-between">
      <div className="min-w-0">
        {breadcrumb && breadcrumb.length > 0 && (
          <nav aria-label="เส้นทางนำทาง" className="mb-1 flex items-center gap-1 text-xs text-muted-foreground">
            {breadcrumb.map((c, i) => (
              <span key={`${c.label}-${i}`} className="flex items-center gap-1">
                {c.href ? (
                  <Link href={c.href} className="hover:text-foreground">
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
        <h1 className="truncate text-2xl font-bold tracking-tight">{title}</h1>
        {description && <p className="mt-1 text-sm text-muted-foreground">{description}</p>}
      </div>
      {actions && <div className="flex shrink-0 flex-wrap items-center gap-2">{actions}</div>}
    </div>
  );
}
