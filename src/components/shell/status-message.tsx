import type { LucideIcon } from "lucide-react";

/**
 * Centred message for the auth interrupt pages (401 / 403).
 *
 * Renders a plain <div>, not a <main>: `forbidden()` raised from a page keeps
 * the (app) layout — header and nav stay, which is what lets the user go
 * somewhere else — and a <main> inside that layout's <main> would be a nested
 * landmark. The standalone caller supplies its own <main>.
 *
 * Height is `min-h-[60vh]`, not `min-h-screen`, so the boxed-in case does not
 * overflow past the header and force the page to scroll.
 */
export function StatusMessage({
  icon: Icon,
  code,
  title,
  description,
  children,
}: {
  icon: LucideIcon;
  code: string;
  title: string;
  description: string;
  children?: React.ReactNode;
}) {
  return (
    <div className="flex min-h-[60vh] flex-1 items-center justify-center px-4 py-10">
      <div className="w-full max-w-md space-y-6 text-center">
        <div className="flex flex-col items-center gap-4">
          <span className="flex size-14 items-center justify-center rounded-full bg-muted">
            <Icon className="size-7 text-muted-foreground" aria-hidden />
          </span>
          <div className="space-y-1.5">
            <p className="text-sm font-medium text-muted-foreground">{code}</p>
            <h1 className="text-xl font-bold tracking-tight">{title}</h1>
            <p className="text-sm text-muted-foreground">{description}</p>
          </div>
        </div>

        {children && <div className="flex justify-center gap-3">{children}</div>}
      </div>
    </div>
  );
}
