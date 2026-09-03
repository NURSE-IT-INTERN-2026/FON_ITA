"use client";

import { ChevronsDownUp, ChevronsUpDown, Clock, ExternalLink, FileText, Link as LinkIcon, Pencil, SearchX } from "lucide-react";
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
import { type AccordionOit, type ItaAccordionEntry } from "@/lib/ita/public-api";
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
 * Open state is controlled (`value` + `onValueChange`) because the
 * collapse-all / expand-all button has to set it. Re-applying the default open
 * set when the year or search mode changes needs no effect: the parent passes
 * a `key` combining both, which remounts this component and re-runs
 * `useState(defaultValue)` — the React-sanctioned reset, instead of the
 * effect-sync the React 19 lint rule forbids.
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
  const [openIds, setOpenIds] = useState<string[]>(defaultValue);
  const allIds = entries.map((e) => String(e.id));

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
      {entries.length > 0 ? (
        // Sticks under the shell header (h-16, z-30) so the control stays
        // reachable while scrolling a long topic list. Takes the card's tone,
        // not the header's: the bar slides over the accordion card (bg-card),
        // and the dark page background is darker than that card — with
        // bg-background it read as a hard black strip in dark mode.
        // -mx-1 bleeds to the viewport edge on mobile so rows don't peek
        // past the bar's sides.
        <div className="sticky top-16 z-20 -mx-1 flex justify-end bg-card/90 px-1 py-1.5 backdrop-blur">
          <Button
            variant="ghost"
            size="sm"
            className="h-8 gap-1.5 px-2.5 text-xs text-muted-foreground"
            onClick={() => setOpenIds(openIds.length === 0 ? allIds : [])}
          >
            {openIds.length === 0 ? (
              <ChevronsUpDown className="size-3.5" aria-hidden />
            ) : (
              <ChevronsDownUp className="size-3.5" aria-hidden />
            )}
            {openIds.length === 0 ? "ขยายทั้งหมด" : "พับเก็บทั้งหมด"}
          </Button>
        </div>
      ) : null}

      <Accordion
        type="multiple"
        value={openIds}
        onValueChange={setOpenIds}
        className="rounded-lg border bg-card"
      >
        {entries.map((entry, idx) => (
          <AccordionItem
            key={entry.id}
            value={String(entry.id)}
            className={cn(idx === 0 && "border-t-0", "transition-colors hover:border-warm/30")}
          >
            <AccordionTrigger className="px-4 hover:no-underline">
              <div className="flex min-w-0 items-center gap-3 pr-2">
                {/* ลำดับที่แสดง = ตำแหน่งในปีนี้ ไม่ใช่ค่า `order` ดิบ — `order` เป็นเลข
                    รันต่อเนื่องข้ามปีที่ยกมาจากระบบเดิม ปี 2569 จึงเริ่มที่ 61 และมีเลข
                    ขาดหาย (ไม่มี 64) ซึ่งผู้อ่านทั่วไปตีความไม่ได้และดูเหมือนข้อมูลพัง */}
                <span className="grid size-9 shrink-0 place-items-center rounded-lg bg-warm-soft/80 font-mono text-sm font-bold tabular-nums text-warm dark:bg-warm/16 dark:text-warm-strong">
                  {String(idx + 1).padStart(2, "0")}
                </span>
                <div className="min-w-0 text-left">
                  <p className="line-clamp-2 font-semibold text-warm dark:text-warm-strong">{entry.title}</p>
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
                <ul className="space-y-0">
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
        // border-b on the li itself (not divide-*) because the hover state
        // paints this same border — a divide utility would fight it.
        "group flex flex-col gap-2 rounded-md border-b border-stone-200/70 px-3 py-2.5 transition-colors last:border-b-0 sm:flex-row sm:items-center sm:justify-between sm:gap-3 dark:border-border/60",
        !disabled && "cursor-pointer hover:border-warm/25 hover:bg-warm-soft/35 dark:hover:bg-warm/10",
      )}
    >
      <div className="flex min-w-0 flex-1 items-start gap-2.5">
        <span
          className={cn(
            "mt-0.5 grid size-7 shrink-0 place-items-center rounded-md",
            isEmpty ? "bg-muted text-muted-foreground" : "bg-warm-soft/80 text-warm dark:bg-warm/16 dark:text-warm-strong",
          )}
        >
          <FileText className="size-3.5" aria-hidden />
        </span>
        <div className="min-w-0 flex-1">
          <span className="line-clamp-2 text-sm font-semibold">
            {oit.title}
            {/* Marks a row that leaves the site instead of opening the modal */}
            {oit.link && (
              <LinkIcon
                className="ml-1.5 inline size-3 shrink-0 text-muted-foreground"
                aria-hidden
              />
            )}
          </span>
          {canManage && (
            <p className="mt-1 flex items-center gap-1 text-xs text-muted-foreground">
              <Clock className="size-3" aria-hidden />
              อัปเดต {formatBELong(oit.updatedAt)}
            </p>
          )}
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
 * what they are about to change. Editing is one click on the footer button.
 */
function OitDetailDialog({
  oit,
  canManage,
  onClose,
}: {
  oit: AccordionOit | null;
  canManage: boolean;
  onClose: () => void;
}) {
  return (
    <Dialog open={oit !== null} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="flex max-h-[90vh] max-w-3xl flex-col gap-0 overflow-hidden p-0">
        {oit && (
          <>
            <DialogHeader className="border-b px-6 py-4">
              <DialogTitle className="text-left text-lg">{oit.title}</DialogTitle>
              {canManage && (
                <DialogDescription className="flex items-center gap-1 pt-1 text-left">
                  <Clock className="size-3.5" aria-hidden />
                  อัปเดตล่าสุด {formatBELong(oit.updatedAt)}
                </DialogDescription>
              )}
            </DialogHeader>

            <div className="flex-1 overflow-y-auto px-6 py-4">
              <div
                className="prose-oit"
                dangerouslySetInnerHTML={{ __html: oit.contentHtml ?? "" }}
              />
            </div>

            {(oit.link || canManage) && (
              <div className="flex flex-wrap items-center justify-end gap-2 border-t px-6 py-3">
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
                    <Link href={`/ita-oit/edit/${oit.id}`}>
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
