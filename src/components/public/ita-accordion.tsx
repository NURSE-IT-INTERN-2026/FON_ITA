"use client";

import { Clock, ExternalLink, FileText, Link as LinkIcon, Pencil, SearchX } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { formatBELong } from "@/lib/date";
import { cn } from "@/lib/utils";

/**
 * Public-facing accordion of ITA topics and their OIT children. On the home
 * page it sits below the hero/video.
 *
 * Clicking a row opens the content in a modal, the way the Lovable prototype
 * and the faculty's current website both behave: someone scanning a year's
 * documents can read one and carry on without losing their place in the list.
 * The `/ita-oit/[id]` page still exists — it is the shareable URL, and what the
 * ITA management screen links to.
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
  const router = useRouter();
  const [activeOit, setActiveOit] = useState<AccordionOit | null>(null);

  const defaultValue =
    entries.length === 0
      ? []
      : isSearching
        ? entries.map((e) => String(e.id))
        : [String(entries[0].id)];

  /**
   * What a click on a row does, in order of what the reader most likely wants:
   * read the content, or failing that follow the link. A row with neither is
   * only actionable for staff, who are sent to the editor to fill it in.
   */
  function openOit(oit: AccordionOit) {
    if (oit.contentHtml) {
      setActiveOit(oit);
      return;
    }
    if (oit.link) {
      window.open(oit.link, "_blank", "noopener,noreferrer");
      return;
    }
    if (canManage) router.push(`/ita-oit/edit/${oit.id}`);
  }

  return (
    <>
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
                    <OitRow
                      key={oit.id}
                      oit={oit}
                      canManage={canManage}
                      onOpen={() => openOit(oit)}
                    />
                  ))}
                </ul>
              )}
            </AccordionContent>
          </AccordionItem>
        ))}
      </Accordion>

      <OitDetailDialog
        oit={activeOit}
        canManage={canManage}
        onEdit={(id) => router.push(`/ita-oit/edit/${id}`)}
        onClose={() => setActiveOit(null)}
      />
    </>
  );
}

function OitRow({
  oit,
  canManage,
  onOpen,
}: {
  oit: AccordionOit;
  canManage: boolean;
  onOpen: () => void;
}) {
  // Nothing to read and nowhere to go: dead weight for a visitor, a to-do for
  // staff. Only the latter gets a click target.
  const isEmpty = !oit.contentHtml && !oit.link;
  const disabled = isEmpty && !canManage;

  return (
    // A <button> would nest the link and edit buttons on the right inside
    // another button, so the row carries the role instead.
    <li
      onClick={disabled ? undefined : onOpen}
      onKeyDown={
        disabled
          ? undefined
          : (e) => {
              if (e.key === "Enter" || e.key === " ") {
                e.preventDefault();
                onOpen();
              }
            }
      }
      role={disabled ? undefined : "button"}
      tabIndex={disabled ? -1 : 0}
      aria-label={disabled ? undefined : `ดู ${oit.title}`}
      className={cn(
        "group flex flex-col gap-2 rounded-md border border-transparent px-3 py-2.5 transition-colors sm:flex-row sm:items-center sm:justify-between sm:gap-3",
        !disabled && "cursor-pointer hover:border-primary/40 hover:bg-accent/50",
      )}
    >
      <div className="flex min-w-0 flex-1 items-start gap-2.5">
        <span
          className={cn(
            "mt-0.5 grid size-7 shrink-0 place-items-center rounded-md",
            isEmpty ? "bg-muted text-muted-foreground" : "bg-primary/10 text-primary",
          )}
        >
          <FileText className="size-3.5" aria-hidden />
        </span>
        <div className="min-w-0 flex-1">
          <span className="truncate text-sm font-semibold">
            {oit.title}
            {/* Marks a row that leaves the site instead of opening the modal */}
            {oit.link && (
              <LinkIcon
                className="ml-1.5 inline size-3 shrink-0 text-muted-foreground"
                aria-hidden
              />
            )}
          </span>
          <p className="mt-1 flex items-center gap-1 text-xs text-muted-foreground">
            <Clock className="size-3" aria-hidden />
            อัปเดต {formatBELong(oit.updatedAt)}
          </p>
        </div>
      </div>

      {/* Keeps the row's own handler from firing underneath these */}
      <div className="flex shrink-0 items-center gap-2" onClick={(e) => e.stopPropagation()}>
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
 * The OIT content, read in place.
 *
 * `contentHtml` was sanitised on the server before it was sent here
 * (`getPublicItasByYear`), which is what makes the injection below safe.
 *
 * Staff see the same modal a visitor sees — that is the point of showing it to
 * them rather than jumping straight to the editor: what the public reads is
 * what they are about to change. Editing is one keystroke away (Enter) or one
 * click on the button the footer leads with.
 */
function OitDetailDialog({
  oit,
  canManage,
  onEdit,
  onClose,
}: {
  oit: AccordionOit | null;
  canManage: boolean;
  onEdit: (id: number) => void;
  onClose: () => void;
}) {
  /**
   * Enter opens the editor — but only when the keystroke was not meant for
   * something else. A link or button inside the modal handles its own Enter,
   * and swallowing that would break the footer's own buttons.
   */
  function handleKeyDown(e: React.KeyboardEvent) {
    if (!canManage || !oit) return;
    if (e.key !== "Enter" || e.defaultPrevented) return;
    if ((e.target as HTMLElement).closest("a, button, input, textarea, select")) return;
    e.preventDefault();
    onEdit(oit.id);
  }

  return (
    <Dialog open={oit !== null} onOpenChange={(open) => !open && onClose()}>
      <DialogContent
        onKeyDown={handleKeyDown}
        // Radix focuses the close button when the modal opens, which would make
        // Enter mean "close" for staff. Point it at the edit button instead, so
        // the shortcut the footer advertises is the one the keyboard performs.
        onOpenAutoFocus={(e) => {
          if (!canManage) return;
          e.preventDefault();
          (e.currentTarget as HTMLElement)
            .querySelector<HTMLElement>("[data-edit-link]")
            ?.focus();
        }}
        className="flex max-h-[90vh] max-w-3xl flex-col gap-0 overflow-hidden p-0"
      >
        {oit && (
          <>
            <DialogHeader className="border-b px-6 py-4">
              <DialogTitle className="text-left text-lg">{oit.title}</DialogTitle>
              <DialogDescription className="flex items-center gap-1 pt-1 text-left">
                <Clock className="size-3.5" aria-hidden />
                อัปเดตล่าสุด {formatBELong(oit.updatedAt)}
              </DialogDescription>
            </DialogHeader>

            <div className="flex-1 overflow-y-auto px-6 py-4">
              <div
                className="prose-oit"
                dangerouslySetInnerHTML={{ __html: oit.contentHtml ?? "" }}
              />
            </div>

            {(oit.link || canManage) && (
              <div className="flex flex-wrap items-center justify-end gap-2 border-t px-6 py-3">
                {canManage && (
                  <span className="mr-auto hidden text-xs text-muted-foreground sm:inline">
                    กด <kbd className="rounded border bg-muted px-1 py-0.5 font-mono">Enter</kbd>{" "}
                    เพื่อแก้ไขเนื้อหานี้
                  </span>
                )}
                {oit.link && (
                  <Button asChild variant="secondary" size="sm" className="gap-1.5">
                    <a href={oit.link} target="_blank" rel="noreferrer">
                      <ExternalLink className="size-3.5" aria-hidden />
                      เปิดลิงก์ภายนอก
                    </a>
                  </Button>
                )}
                {canManage && (
                  <Button asChild size="sm" className="gap-1.5">
                    <Link href={`/ita-oit/edit/${oit.id}`} data-edit-link>
                      <Pencil className="size-3.5" aria-hidden />
                      แก้ไข
                    </Link>
                  </Button>
                )}
              </div>
            )}
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}

/**
 * Match the prisma select in `getPublicItasByYear` — kept as a type alias so
 * the page can pass server data straight through without a mapping step.
 * `updatedAt` arrives as a serialisable ISO string after crossing the
 * Server→Client boundary, so the type accepts both forms.
 */
export type AccordionOit = {
  id: number;
  title: string;
  link: string | null;
  /** Already sanitised on the server. Null when the OIT has no content. */
  contentHtml: string | null;
  updatedAt: string | Date;
};

export type ItaAccordionEntry = {
  id: number;
  title: string;
  year: string;
  order: number;
  oits: AccordionOit[];
};
