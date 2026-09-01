"use client";

import Link from "next/link";
import { buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";

/**
 * One page link of PaginationNav. Client-side only for the disabled/active
 * styling via buttonVariants; PaginationNav itself stays a Server Component
 * and passes only serialisable props (no `hrefFor` function across the
 * server→client boundary).
 *
 * `scroll={false}`: page N holds the same list the reader is already looking
 * at — Next's default would snap to the top of the page on every page/filter
 * change, forcing them to find their place again.
 */
export function PaginationLink({
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
    <Link
      href={href}
      scroll={false}
      aria-label={label}
      aria-current={active ? "page" : undefined}
      className={classes}
    >
      {children}
    </Link>
  );
}
