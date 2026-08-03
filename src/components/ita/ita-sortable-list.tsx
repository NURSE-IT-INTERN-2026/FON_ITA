"use client";

import {
  DndContext,
  PointerSensor,
  closestCenter,
  useSensor,
  useSensors,
  type DragEndEvent,
} from "@dnd-kit/core";
import {
  SortableContext,
  arrayMove,
  rectSortingStrategy,
  useSortable,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { ExternalLink, FileText, GripVertical, Plus } from "lucide-react";
import Link from "next/link";
import { useOptimistic, useTransition } from "react";
import { toast } from "sonner";
import { reorderIta } from "@/actions/ita";
import { ItaCardActions } from "@/components/ita/ita-manage";
import { YearBadge } from "@/components/ita/year-badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import type { ItaWithOits } from "@/lib/ita/queries";

// How many OIT titles to show on a card before collapsing the rest into a count.
const OIT_PREVIEW = 3;

/**
 * dnd-kit ships its screen-reader text in English. It is read aloud to the
 * person using the page, which makes it user-facing text — Thai, like every
 * other label in the system (CLAUDE.md). The element holding this is what
 * `aria-describedby` on each drag handle points to.
 */
const A11Y = {
  screenReaderInstructions: {
    draggable:
      "กด Space เพื่อเริ่มลากหัวข้อ · ใช้ปุ่มลูกศรเพื่อย้ายตำแหน่ง · กด Space อีกครั้งเพื่อวาง · กด Escape เพื่อยกเลิก",
  },
  announcements: {
    onDragStart: ({ active }: { active: { id: string | number } }) =>
      `เริ่มลากหัวข้อลำดับที่ ${active.id}`,
    onDragOver: ({ over }: { over: { id: string | number } | null }) =>
      over ? `ย้ายมาอยู่เหนือหัวข้อลำดับที่ ${over.id}` : "ออกนอกพื้นที่วาง",
    onDragEnd: ({ over }: { over: { id: string | number } | null }) =>
      over ? `วางหัวข้อที่ตำแหน่งของลำดับที่ ${over.id} แล้ว` : "ยกเลิกการลาก",
    onDragCancel: () => "ยกเลิกการลาก ลำดับกลับไปเป็นเหมือนเดิม",
  },
};

/**
 * Reorderable ITA list. Client Component because DnD needs event handlers; the
 * server `ItaListView` keeps the page header, year picker, and empty state.
 *
 * Optimistic update via `useOptimistic` so the dragged card snaps to its new
 * slot instantly. The Server Action does `revalidatePath`, so when its
 * transition ends the prop here is replaced by the freshly queried rows and the
 * optimistic state falls back to it — keeping local and server in sync without
 * an extra effect.
 *
 * `canManage` decides whether to mount DnD at all. A reader who can not write
 * sees a plain grid, never a `DndContext` with disabled sensors.
 */
export function ItaSortableList({
  itas,
  canManage,
}: {
  itas: ItaWithOits[];
  canManage: boolean;
}) {
  const [optimisticItas, setOptimisticItas] = useOptimistic(
    itas,
    (_current, reordered: ItaWithOits[]) => reordered,
  );
  const [, startTransition] = useTransition();

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
  );

  function handleDragEnd(e: DragEndEvent) {
    const { active, over } = e;
    if (!over || active.id === over.id) return;

    const ids = optimisticItas.map((i) => String(i.id));
    const oldIndex = ids.indexOf(String(active.id));
    const newIndex = ids.indexOf(String(over.id));
    if (oldIndex < 0 || newIndex < 0) return;

    const reordered = arrayMove(optimisticItas, oldIndex, newIndex).map((ita, i) => ({
      ...ita,
      order: i + 1,
    }));

    startTransition(async () => {
      setOptimisticItas(reordered);
      const year = reordered[0]?.year ?? "";
      const formData = new FormData();
      formData.set("year", year);
      reordered.forEach((r) => formData.append("orderedIds", String(r.id)));
      const result = await reorderIta(formData);
      if (result.error) {
        toast.error(result.error);
        return;
      }
      toast.success("จัดลำดับใหม่แล้ว");
    });
  }

  if (!canManage) {
    return (
      <div className="grid gap-4 md:grid-cols-2">
        {optimisticItas.map((ita, idx) => (
          <ItaCard key={ita.id} ita={ita} position={idx + 1} canManage={false} />
        ))}
      </div>
    );
  }

  return (
    // `id` is required for SSR: without it dnd-kit numbers its accessibility
    // description element from a module-level counter, so the server renders
    // aria-describedby="DndDescribedBy-0" while the browser — which has already
    // mounted other contexts — produces "-1" and React reports a hydration
    // mismatch. A fixed id makes both sides agree.
    <DndContext
      id="ita-sortable"
      accessibility={A11Y}
      sensors={sensors}
      collisionDetection={closestCenter}
      onDragEnd={handleDragEnd}
    >
      <SortableContext
        items={optimisticItas.map((i) => String(i.id))}
        strategy={rectSortingStrategy}
      >
        <div className="grid gap-4 md:grid-cols-2">
          {optimisticItas.map((ita, idx) => (
            <SortableItaCard key={ita.id} ita={ita} position={idx + 1} />
          ))}
        </div>
      </SortableContext>
    </DndContext>
  );
}

function SortableItaCard({ ita, position }: { ita: ItaWithOits; position: number }) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: String(ita.id),
  });

  const style: React.CSSProperties = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  };

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={isDragging ? "rounded-xl ring-2 ring-primary" : undefined}
    >
      <ItaCard
        ita={ita}
        position={position}
        canManage
        dragHandle={{ attributes, listeners }}
      />
    </div>
  );
}

type DragHandleProps = {
  attributes: ReturnType<typeof useSortable>["attributes"];
  listeners: ReturnType<typeof useSortable>["listeners"];
};

function ItaCard({
  ita,
  position,
  canManage,
  dragHandle,
}: {
  ita: ItaWithOits;
  /** ตำแหน่งในรายการ (1, 2, 3…) — ไม่ใช่ `ita.order` ดู badge ด้านล่าง */
  position: number;
  canManage: boolean;
  dragHandle?: DragHandleProps;
}) {
  const extra = ita.oits.length - OIT_PREVIEW;

  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex items-start justify-between gap-3">
          <div className="flex min-w-0 items-start gap-2">
            {dragHandle && (
              <button
                type="button"
                {...dragHandle.attributes}
                {...dragHandle.listeners}
                className="mt-1 inline-flex shrink-0 cursor-grab touch-none text-muted-foreground hover:text-foreground"
                aria-label="ลากเพื่อจัดลำดับ"
              >
                <GripVertical className="size-4" aria-hidden />
              </button>
            )}
            {/* ตำแหน่งในปี ไม่ใช่ `ita.order` — `order` เป็นเลขรันต่อเนื่องข้ามปีที่ยกมา
                จากระบบเดิม (ปี 2569 เริ่มที่ 61 และไม่มีเลข 64) ตัวเลขนั้นไม่มีความหมาย
                กับคนอ่าน และ requirement ให้ซ่อนลำดับออกจากฟอร์มอยู่แล้ว */}
            <span className="mt-0.5 inline-flex h-7 min-w-7 shrink-0 items-center justify-center rounded-md bg-orange-500/10 px-1.5 font-mono text-xs font-semibold text-orange-500 tabular-nums">
              {String(position).padStart(2, "0")}
            </span>
            <div className="min-w-0">
              <CardTitle className="text-base leading-snug">{ita.title}</CardTitle>
              <div className="mt-2 flex flex-wrap items-center gap-2">
                <YearBadge year={ita.year} />
                <span className="inline-flex items-center gap-1 text-xs text-muted-foreground">
                  <FileText className="size-3.5" aria-hidden /> {ita.oits.length} OIT
                </span>
              </div>
            </div>
          </div>

          {canManage && (
            <ItaCardActions
              ita={{ id: ita.id, title: ita.title, year: ita.year, order: ita.order }}
            />
          )}
        </div>
      </CardHeader>

      <CardContent className="pt-0">
        <div className="rounded-md border bg-muted/30 p-2">
          <div className="flex flex-wrap items-center gap-1.5">
            {canManage && (
              <Button asChild size="sm" variant="secondary">
                <Link href={`/ita-oit/create/${ita.id}`}>
                  <Plus className="mr-1 size-3.5" aria-hidden /> เพิ่ม OIT
                </Link>
              </Button>
            )}

            {ita.oits.length === 0 ? (
              <span className="px-2 py-1 text-xs italic text-muted-foreground">
                ยังไม่มี OIT ในหัวข้อนี้
              </span>
            ) : (
              <>
                {ita.oits.slice(0, OIT_PREVIEW).map((oit) => (
                  <OitChip key={oit.id} oit={oit} />
                ))}
                {extra > 0 && (
                  <span className="px-1.5 py-1 text-xs text-muted-foreground">
                    +{extra} รายการ
                  </span>
                )}
              </>
            )}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

const CHIP_CLASS =
  "inline-flex max-w-[240px] items-center gap-1.5 rounded-md border bg-card px-2.5 py-1 text-xs font-medium transition-colors hover:border-primary/40 hover:bg-accent";

/**
 * An OIT is either a shortcut to a document elsewhere or a page of its own.
 *
 * With a `link` it opens that link in a new tab — the behaviour staff know from
 * the old system. Without one it goes to the OIT page, which shows the content
 * (and, for ADMIN+, the way to edit it). The Lovable prototype popped a modal
 * here instead; that existed because it had no detail page, and this one does.
 */
function OitChip({ oit }: { oit: ItaWithOits["oits"][number] }) {
  if (oit.link) {
    return (
      <a
        href={oit.link}
        target="_blank"
        rel="noopener noreferrer"
        className={CHIP_CLASS}
      >
        <FileText className="size-3 shrink-0 text-primary" aria-hidden />
        <span className="truncate">{oit.title}</span>
        <ExternalLink className="size-3 shrink-0 text-muted-foreground" aria-hidden />
      </a>
    );
  }

  return (
    <Link href={`/ita-oit/${oit.id}`} className={CHIP_CLASS}>
      <FileText className="size-3 shrink-0 text-primary" aria-hidden />
      <span className="truncate">{oit.title}</span>
    </Link>
  );
}
