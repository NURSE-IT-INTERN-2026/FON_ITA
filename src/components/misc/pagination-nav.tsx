import { ChevronLeft, ChevronRight } from "lucide-react";
import Link from "next/link";
import {
  Pagination,
  PaginationContent,
  PaginationItem,
} from "@/components/ui/pagination";
import { buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";

/**
 * Page links for a server-rendered list.
 *
 * Uses the shadcn Pagination shell for layout, but its own <Link>s rather than
 * `PaginationLink`: that renders a plain <a>, which loses client-side
 * navigation and would need the basePath spelled out by hand.
 */
export function PaginationNav({
  page,
  totalPages,
  hrefFor,
}: {
  page: number;
  totalPages: number;
  /** Build the URL for a page — no basePath, <Link> adds it. */
  hrefFor: (page: number) => string;
}) {
  if (totalPages <= 1) return null;

  return (
    <Pagination className="mt-6">
      <PaginationContent>
        <PaginationItem>
          <PageLink
            href={hrefFor(page - 1)}
            disabled={page === 1}
            label="หน้าก่อนหน้า"
            className="gap-1 pl-2.5"
          >
            <ChevronLeft className="size-4" aria-hidden />
            ก่อนหน้า
          </PageLink>
        </PaginationItem>

        {pageWindow(page, totalPages).map((n, i) =>
          n === null ? (
            <PaginationItem key={`gap-${i}`}>
              <span className="px-2 text-sm text-muted-foreground" aria-hidden>
                …
              </span>
            </PaginationItem>
          ) : (
            <PaginationItem key={n}>
              <PageLink href={hrefFor(n)} active={n === page} label={`หน้า ${n}`}>
                {n}
              </PageLink>
            </PaginationItem>
          ),
        )}

        <PaginationItem>
          <PageLink
            href={hrefFor(page + 1)}
            disabled={page === totalPages}
            label="หน้าถัดไป"
            className="gap-1 pr-2.5"
          >
            ถัดไป
            <ChevronRight className="size-4" aria-hidden />
          </PageLink>
        </PaginationItem>
      </PaginationContent>
    </Pagination>
  );
}

function PageLink({
  href,
  active,
  disabled,
  label,
  className,
  children,
}: {
  href: string;
  active?: boolean;
  disabled?: boolean;
  label: string;
  className?: string;
  children: React.ReactNode;
}) {
  const classes = cn(
    buttonVariants({ variant: active ? "outline" : "ghost", size: children ? "default" : "icon" }),
    "min-w-9",
    className,
  );

  // A disabled link is rendered as a span: an <a> with no href is still in the
  // tab order and reads as a link to a screen reader.
  if (disabled) {
    return (
      <span className={cn(classes, "pointer-events-none opacity-50")} aria-disabled>
        {children}
      </span>
    );
  }

  return (
    <Link href={href} aria-label={label} aria-current={active ? "page" : undefined} className={classes}>
      {children}
    </Link>
  );
}

/**
 * Page numbers to show: always the first and last, plus a window around the
 * current page. `null` marks a gap. Keeps the row a fixed width no matter how
 * many pages there are.
 */
function pageWindow(page: number, totalPages: number): (number | null)[] {
  if (totalPages <= 7) return Array.from({ length: totalPages }, (_, i) => i + 1);

  const pages = new Set([1, totalPages, page, page - 1, page + 1]);
  const sorted = [...pages].filter((n) => n >= 1 && n <= totalPages).sort((a, b) => a - b);

  const out: (number | null)[] = [];
  let previous = 0;
  for (const n of sorted) {
    if (previous && n - previous > 1) out.push(null);
    out.push(n);
    previous = n;
  }
  return out;
}
