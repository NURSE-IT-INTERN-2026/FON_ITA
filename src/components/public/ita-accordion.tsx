"use client";

import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import { Button } from "@/components/ui/button";
import { ExternalLink, FileText, Pencil, SearchX } from "lucide-react";
import Link from "next/link";
import { formatBELong } from "@/lib/date";
import { cn } from "@/lib/utils";

/**
 * Public-facing accordion of ITA topics and their OIT children. On the home
 * page it sits below the hero/video.
 *
 * Client Component because Radix Accordion tracks open state in React. Clicking
 * an OIT row links to its detail page (`/ita-oit/[id]`) — the Lovable prototype
 * opened a modal here because it had no detail page; this app does (F15).
 *
 * `entries` are already filtered by year and search before they reach this
 * component; an empty list shows a contextual empty state.
 *
 * Open state uses `defaultValue`, not `value` + state: deriving it in
 * `useEffect` triggered cascading renders (the React 19 lint rule), and a
 * controlled accordion would need that effect to track `entries`/`isSearching`
 * changes. Instead the parent passes a `key` combining the year and the
 * search-mode toggle, which remounts this component at exactly the moments
 * the default open set should change. Manual opens and closes survive between
 * those remounts because there are none in between.
 */
export function ItaAccordion({
  entries,
  isSearching,
  canManage,
}: {
  entries: ItaAccordionEntry[];
  isSearching: boolean;
  canManage: boolean;
}) {
  const defaultValue =
    entries.length === 0
      ? []
      : isSearching
        ? entries.map((e) => String(e.id))
        : [String(entries[0].id)];

  return (
    <Accordion
      type="multiple"
      defaultValue={defaultValue}
      className="rounded-lg border bg-card"
    >
      {entries.map((entry, idx) => (
        <AccordionItem
          key={entry.id}
          value={String(entry.id)}
          className={cn(idx === 0 && "border-t-0", "transition-colors hover:border-primary/40")}
        >
          <AccordionTrigger className="px-4 hover:no-underline">
            <div className="flex min-w-0 items-center gap-3 pr-2">
              <span className="grid size-9 shrink-0 place-items-center rounded-lg bg-orange-500/10 font-mono text-sm font-bold tabular-nums text-orange-500">
                {String(entry.order).padStart(2, "0")}
              </span>
              <div className="min-w-0 text-left">
                <p className="truncate font-semibold text-orange-500">{entry.title}</p>
                <p className="flex items-center gap-1 text-xs font-normal text-muted-foreground">
                  <span className="inline-flex items-center gap-1 rounded-full bg-secondary px-2 py-0.5 font-medium text-secondary-foreground">
                    {entry.oits.length} รายการย่อย
                  </span>
                </p>
              </div>
            </div>
          </AccordionTrigger>
          <AccordionContent className="px-2 pb-3 pt-0">
            {entry.oits.length === 0 ? (
              <div className="flex items-center gap-2 px-2 py-3 text-sm text-muted-foreground">
                <SearchX className="size-4 shrink-0" aria-hidden />
                <span>
                  {isSearching ? "ไม่พบรายการ OIT ที่ตรงกับการค้นหา" : "ยังไม่มีรายการ OIT ในหัวข้อนี้"}
                </span>
              </div>
            ) : (
              <ul className="space-y-1">
                {entry.oits.map((oit) => (
                  <OitRow key={oit.id} oit={oit} canManage={canManage} />
                ))}
              </ul>
            )}
          </AccordionContent>
        </AccordionItem>
      ))}
    </Accordion>
  );
}

function OitRow({
  oit,
  canManage,
}: {
  oit: ItaAccordionEntry["oits"][number];
  canManage: boolean;
}) {
  return (
    <li className="group flex flex-col gap-2 rounded-md border border-transparent px-3 py-2.5 transition-colors sm:flex-row sm:items-center sm:justify-between sm:gap-3 hover:border-primary/40 hover:bg-accent/50">
      <Link
        href={oit.link ?? `/ita-oit/${oit.id}`}
        {...(oit.link ? { target: "_blank", rel: "noreferrer" } : {})}
        className="flex min-w-0 flex-1 items-start gap-2.5"
      >
        <span className="mt-0.5 grid size-7 shrink-0 place-items-center rounded-md bg-orange-500/10 text-orange-500">
          <FileText className="size-3.5" aria-hidden />
        </span>
        <div className="min-w-0 flex-1">
          <span className="truncate text-sm font-semibold underline-offset-2 group-hover:underline">
            {oit.title}
          </span>
          <p className="mt-1 flex items-center gap-1 text-xs text-muted-foreground">
            อัปเดต {formatBELong(oit.updatedAt)}
          </p>
        </div>
      </Link>
      <div className="flex shrink-0 items-center gap-2">
        {oit.link && (
          <Button asChild size="sm" variant="ghost" className="gap-1.5">
            <a href={oit.link} target="_blank" rel="noreferrer">
              <ExternalLink className="size-3.5" aria-hidden />
              เปิดลิงก์
            </a>
          </Button>
        )}
        {canManage && (
          <Button asChild size="sm" variant="ghost" className="gap-1.5">
            <Link href={`/ita-oit/edit/${oit.id}`}>
              <Pencil className="size-3.5" aria-hidden />
              แก้ไข
            </Link>
          </Button>
        )}
      </div>
    </li>
  );
}

/**
 * Match the prisma select in `getItasByYear` — kept as a type alias so the page
 * can pass server data straight through without a mapping step. `updatedAt`
 * arrives as a serialisable ISO string after crossing the Server→Client
 * boundary, so the type accepts both forms.
 */
export type ItaAccordionEntry = {
  id: number;
  title: string;
  year: string;
  order: number;
  oits: { id: number; title: string; link: string | null; updatedAt: string | Date }[];
};
