"use client";

import { Search, UserRoundSearch, X } from "lucide-react";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { RoleBadge } from "@/components/misc/role-badge";
import { PaginationNav } from "@/components/misc/pagination-nav";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import type { AppRole } from "@/generated/prisma/enums";
import type { ActivityCategory } from "@/lib/activity/meta";
import { ACTIVITY_CATEGORIES, categoryLabel, getActivityMeta } from "@/lib/activity/meta";
import { cn } from "@/lib/utils";

const ALL = "ALL";

type ActivityListItem = {
  id: number;
  actorName: string;
  actorRole: AppRole;
  action: string;
  target: string | null;
  detail: string | null;
  createdAtLabel: string;
};

export function ActivityLogClient({
  activities,
  counts,
  actors,
  page,
  totalPages,
  total,
  action,
  actorId,
  category,
  query,
  from,
  to,
  datesAreDefault,
  allActive,
}: {
  activities: ActivityListItem[];
  counts: { action: string; count: number }[];
  actors: { actorId: number; actorName: string; actorRole: AppRole }[];
  page: number;
  totalPages: number;
  total: number;
  action?: string;
  actorId?: number;
  category?: ActivityCategory;
  query?: string;
  /** Effective window — the month default when no explicit dates are set. */
  from?: string;
  to?: string;
  /** True when from/to are the server's current-month default, not a filter. */
  datesAreDefault: boolean;
  /** True when the user opted out of the month default via ?all=1. */
  allActive: boolean;
}) {
  const router = useRouter();
  const grandTotal = counts.reduce((sum, item) => sum + item.count, 0);
  const filtered = Boolean(
    action || actorId || category || query || ((from || to) && !datesAreDefault),
  );
  const [searchText, setSearchText] = useState(query ?? "");
  const [prevQuery, setPrevQuery] = useState(query);
  const [actorPickerOpen, setActorPickerOpen] = useState(false);
  const [actorSearch, setActorSearch] = useState("");
  const actorPickerRef = useRef<HTMLDivElement | null>(null);
  const selectedActor = actors.find((item) => item.actorId === actorId);
  const filteredActors = actors.filter((item) => {
    const term = actorSearch.trim().toLocaleLowerCase("th");
    if (!term) return true;
    return item.actorName.toLocaleLowerCase("th").includes(term);
  });

  // The inputs show the effective window, but the URL carries only dates the
  // user chose — threading the month default into it would silently turn
  // "this month" into an explicit date filter the moment another filter moved.
  const urlFrom = datesAreDefault ? undefined : from;
  const urlTo = datesAreDefault ? undefined : to;

  // Sync the typing buffer when the URL's ?q= changes from outside this input
  // (browser back/forward, clearing a filter chip). React's sanctioned
  // adjust-state-during-render pattern — setState during render re-renders
  // immediately without committing, unlike an effect which cascades.
  if (query !== prevQuery) {
    setPrevQuery(query);
    setSearchText(query ?? "");
  }

  useEffect(() => {
    function onPointerDown(event: MouseEvent) {
      if (!actorPickerRef.current?.contains(event.target as Node)) {
        setActorPickerOpen(false);
      }
    }

    document.addEventListener("mousedown", onPointerDown);
    return () => document.removeEventListener("mousedown", onPointerDown);
  }, []);

  /**
   * The filter state a navigation should carry when nothing overrides it.
   * Merged with `{...base, ...next}` so a caller passing `from: undefined`
   * explicitly DROPS the date, while omitting the key keeps it — the
   * distinction the old destructuring defaults could not make.
   */
  const baseHrefState = {
    action,
    actorId,
    category,
    query,
    from: urlFrom,
    to: urlTo,
    all: allActive,
  };

  function buildHref(next: {
    page?: number;
    action?: string;
    actorId?: number;
    category?: ActivityCategory;
    query?: string;
    from?: string;
    to?: string;
    all?: boolean;
  }) {
    const params = new URLSearchParams();

    if (next.action) params.set("action", next.action);
    if (next.actorId) params.set("actor", String(next.actorId));
    if (next.category) params.set("category", next.category);
    if (next.query) params.set("q", next.query);
    if (next.from) params.set("from", next.from);
    if (next.to) params.set("to", next.to);
    if (next.all) params.set("all", "1");
    if (next.page && next.page > 1) params.set("page", String(next.page));

    const search = params.toString();
    return search ? `/activity-log?${search}` : "/activity-log";
  }

  /** Any filter change: resets to page 1, keeps everything not overridden. */
  function pushFilters(
    next: Partial<{
      action: string;
      actorId: number;
      category: ActivityCategory;
      query: string;
      from: string;
      to: string;
      all: boolean;
    }>,
  ) {
    router.push(buildHref({ ...baseHrefState, ...next, page: 1 }));
  }

  function commitSearch(term: string) {
    const nextQuery = term.trim() || undefined;
    if ((query ?? "") === (nextQuery ?? "")) return;
    pushFilters({ query: nextQuery });
  }

  return (
    <div className="space-y-6">
      <section className="rounded-2xl border border-stone-200/80 bg-card p-4 space-y-4 dark:border-border/80">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
          <div className="space-y-1">
            <p className="text-sm font-medium text-foreground">เหตุการณ์ล่าสุดในระบบ</p>
            <p className="text-xs text-muted-foreground">
              {filtered
                ? `แสดง ${total} จาก ${grandTotal} รายการตามตัวกรองปัจจุบัน`
                : datesAreDefault
                  ? `เหตุการณ์เดือนนี้ · ${total} จาก ${grandTotal} รายการทั้งหมด — กด "ล้างวันที่" เพื่อดูทั้งหมด`
                  : `ทั้งหมด ${grandTotal} รายการ เรียงจากใหม่ไปเก่า`}
            </p>
          </div>
        </div>

        <form
          className="space-y-2"
          onSubmit={(event) => {
            event.preventDefault();
            commitSearch(searchText);
          }}
        >
          <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
            ค้นหาในบันทึก
          </p>
          <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
            <div className="relative min-w-0 flex-1 sm:min-w-72">
              <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" aria-hidden />
              <Input
                value={searchText}
                onChange={(event) => setSearchText(event.currentTarget.value)}
                placeholder="ค้นหาจากผู้กระทำ เป้าหมาย หรือรายละเอียดกิจกรรม"
                className="pl-9"
                aria-label="ค้นหาในบันทึกกิจกรรม"
              />
            </div>
            <div className="flex items-center gap-2">
              <Button type="submit" size="sm" className="h-9 px-3">
                ค้นหา
              </Button>
              {query ? (
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  className="h-9 px-3"
                  onClick={() => {
                    setSearchText("");
                    commitSearch("");
                  }}
                >
                  ล้างคำค้น
                </Button>
              ) : null}
            </div>
          </div>
        </form>

        <div className="flex flex-wrap items-start gap-4">
          <div className="w-full space-y-2 sm:w-auto sm:min-w-64">
            <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              ประเภทกิจกรรม
            </p>
            <Select
              value={action ?? ALL}
              onValueChange={(next) => pushFilters({ action: next === ALL ? undefined : next })}
            >
              <SelectTrigger className="w-full sm:w-64" aria-label="กรองตามประเภทกิจกรรม">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={ALL}>ทุกกิจกรรม ({grandTotal})</SelectItem>
                {counts.map(({ action: itemAction, count }) => (
                  <SelectItem key={itemAction} value={itemAction}>
                    {getActivityMeta(itemAction).label} ({count})
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="w-full space-y-2 sm:w-auto sm:min-w-52">
            <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              หมวดข้อมูล
            </p>
            <Select
              value={category ?? ALL}
              onValueChange={(next) =>
                pushFilters({ category: next === ALL ? undefined : (next as ActivityCategory) })
              }
            >
              <SelectTrigger className="w-full sm:w-56" aria-label="กรองตามหมวดข้อมูล">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={ALL}>ทุกหมวด</SelectItem>
                {ACTIVITY_CATEGORIES.map((item) => (
                  <SelectItem key={item.value} value={item.value}>
                    {categoryLabel(item.value)}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="w-full space-y-2 sm:w-auto sm:min-w-64">
            <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              ผู้ใช้
            </p>
            <div className="relative w-full sm:w-64" ref={actorPickerRef}>
              <Button
                type="button"
                variant="outline"
                className="h-9 w-full justify-between px-3 text-left font-normal"
                onClick={() => {
                  setActorPickerOpen((open) => !open);
                  setActorSearch("");
                }}
                aria-expanded={actorPickerOpen}
                aria-label="เลือกผู้ใช้"
              >
                <span className="truncate">
                  {selectedActor ? selectedActor.actorName : "ทุกผู้ใช้"}
                </span>
                <UserRoundSearch className="size-4 text-muted-foreground" aria-hidden />
              </Button>

              {actorPickerOpen ? (
                <div className="absolute z-20 mt-2 w-full rounded-md border bg-popover p-2 shadow-md">
                  <div className="relative mb-2">
                    <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" aria-hidden />
                    <Input
                      value={actorSearch}
                      onChange={(event) => setActorSearch(event.currentTarget.value)}
                      placeholder="พิมพ์ชื่อผู้ใช้"
                      className="pl-9 pr-9"
                      aria-label="ค้นหาผู้ใช้ในตัวกรอง"
                    />
                    {actorSearch ? (
                      <button
                        type="button"
                        className="absolute right-3 top-1/2 -translate-y-1/2 p-1.5 -m-1.5 text-muted-foreground hover:text-foreground"
                        onClick={() => setActorSearch("")}
                        aria-label="ล้างคำค้นผู้ใช้"
                      >
                        <X className="size-4" aria-hidden />
                      </button>
                    ) : null}
                  </div>

                  <div className="max-h-60 overflow-y-auto rounded-sm border">
                    <button
                      type="button"
                      className={cn(
                        "flex w-full items-center justify-between px-3 py-2 text-left text-sm hover:bg-accent hover:text-accent-foreground",
                        !actorId && "bg-accent/60",
                      )}
                      onClick={() => {
                        pushFilters({ actorId: undefined });
                        setActorPickerOpen(false);
                        setActorSearch("");
                      }}
                    >
                      <span>ทุกผู้ใช้</span>
                    </button>

                    {filteredActors.length > 0 ? (
                      filteredActors.map((item) => (
                        <button
                          key={item.actorId}
                          type="button"
                          className={cn(
                            "flex w-full items-center justify-between gap-3 px-3 py-2 text-left text-sm hover:bg-accent hover:text-accent-foreground",
                            actorId === item.actorId && "bg-accent/60",
                          )}
                          onClick={() => {
                            pushFilters({ actorId: item.actorId });
                            setActorPickerOpen(false);
                            setActorSearch("");
                          }}
                        >
                          <span className="truncate">{item.actorName}</span>
                          <RoleBadge role={item.actorRole} className="shrink-0" />
                        </button>
                      ))
                    ) : (
                      <p className="px-3 py-3 text-sm text-muted-foreground">ไม่พบผู้ใช้ที่ตรงคำค้น</p>
                    )}
                  </div>
                </div>
              ) : null}
            </div>
          </div>

          {/* One line at every size: the two date fields share the row and shrink
              (flex-1 min-w-0) while the button keeps its width. */}
          <div className="flex w-full items-end gap-2 sm:w-auto">
            <div className="min-w-0 flex-1 space-y-2 sm:flex-none">
              <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                วันที่เริ่มต้น
              </p>
              <Input
                type="date"
                className="w-full sm:w-44"
                value={from ?? ""}
                onChange={(event) =>
                  pushFilters({ from: event.currentTarget.value || undefined, all: false })
                }
              />
            </div>

            <div className="min-w-0 flex-1 space-y-2 sm:flex-none">
              <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                วันที่สิ้นสุด
              </p>
              <Input
                type="date"
                className="w-full sm:w-44"
                value={to ?? ""}
                onChange={(event) =>
                  pushFilters({ to: event.currentTarget.value || undefined, all: false })
                }
              />
            </div>

            {from || to ? (
              <Button
                variant="ghost"
                size="sm"
                className="h-9 shrink-0 px-3"
                onClick={() => pushFilters({ from: undefined, to: undefined, all: true })}
              >
                ล้างวันที่
              </Button>
            ) : null}
          </div>
        </div>

        {category ? (
          <p className="text-xs text-muted-foreground">
            แสดงหมวด <span className="font-medium text-foreground">{categoryLabel(category)}</span>
          </p>
        ) : null}

        {filtered ? (
          <div className="flex border-t border-stone-200/80 pt-4 dark:border-border/70">
            <Button
              variant="outline"
              size="sm"
              className="h-9 border-orange-200 bg-orange-50 px-4 text-orange-700 hover:bg-orange-100 hover:text-orange-800 dark:border-orange-900/60 dark:bg-orange-950/30 dark:text-orange-300 dark:hover:bg-orange-950/50 dark:hover:text-orange-200"
              onClick={() => router.push("/activity-log")}
            >
              ล้างตัวกรองทั้งหมด
            </Button>
          </div>
        ) : null}
      </section>

      {activities.length === 0 ? (
        <section className="rounded-lg border border-dashed bg-card px-6 py-10 text-center text-sm text-muted-foreground">
          {filtered
            ? "ไม่พบกิจกรรมที่ตรงตัวกรอง ลองเปลี่ยนคำค้นหรือเงื่อนไขแล้วค้นอีกครั้ง"
            : datesAreDefault
              ? "ไม่มีกิจกรรมในเดือนนี้ — กด \"ล้างวันที่\" เพื่อดูย้อนหลังทั้งหมด"
              : "ยังไม่มีกิจกรรมในระบบ กิจกรรมสำคัญจะถูกบันทึกและแสดงที่หน้านี้"}
        </section>
      ) : (
        <section className="overflow-hidden rounded-lg border bg-card">
          <div className="divide-y">
            {activities.map((entry) => {
              const meta = getActivityMeta(entry.action);
              const Icon = meta.icon;

              return (
                <article
                  key={entry.id}
                  className="flex flex-col gap-3 px-4 py-3 transition-colors hover:bg-muted/30 sm:flex-row sm:items-start"
                >
                  <div
                    className={cn(
                      "flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border",
                      meta.chipClassName,
                    )}
                  >
                    <Icon className="size-4" aria-hidden />
                  </div>

                  <div className="min-w-0 flex-1 space-y-1">
                    <div className="flex flex-wrap items-center gap-x-2 gap-y-1 text-sm">
                      {/* Badge belongs to the ACTOR, so it sits on their name.
                          After the action label it read as the object —
                          "เพิ่มผู้ใช้ ผู้ดูแลสูงสุด" looked like the created
                          account's role instead of the operator's. */}
                      <span className="font-semibold text-foreground">{entry.actorName}</span>
                      <RoleBadge role={entry.actorRole} />
                      <span className="text-foreground">{meta.label}</span>
                    </div>

                    {entry.target ? (
                      <p className="text-sm text-muted-foreground">เป้าหมาย: {entry.target}</p>
                    ) : null}

                    {entry.detail ? (
                      <p className="text-xs text-muted-foreground">{entry.detail}</p>
                    ) : null}
                  </div>

                  <div className="shrink-0 text-xs font-mono text-muted-foreground sm:pt-0.5 sm:text-right">
                    {entry.createdAtLabel}
                  </div>
                </article>
              );
            })}
          </div>
        </section>
      )}

      <PaginationNav
        page={page}
        totalPages={totalPages}
        hrefFor={(nextPage) => buildHref({ ...baseHrefState, page: nextPage })}
      />
    </div>
  );
}
