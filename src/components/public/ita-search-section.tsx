"use client";

import { ListChecks, Search, TriangleAlert, X } from "lucide-react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import { ItaAccordion, type ItaAccordionEntry } from "@/components/public/ita-accordion";
import { EmptyState } from "@/components/misc/empty-state";
import { FeaturedSurface, WarmSectionHeading } from "@/components/shell/surfaces";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { currentBEYear } from "@/lib/date";
import { fetchItaYears, fetchItasByYear } from "@/lib/ita/public-api";

/**
 * Public "ITA ปี …" section on the home page: year picker + search box +
 * accordion of matching topics.
 *
 * **Reads its data from the Public API in the browser**, not from the server
 * (stakeholder requirement) — the same `/api/v1/ita/{year}` the faculty website
 * consumes, so the published page and the published contract can never drift
 * apart without someone noticing.
 *
 * Year stays in the URL (/?year=2568) so a view can be linked to; the picker
 * pushes the new URL and the fetch below follows it. Search is pure client
 * state over the rows already fetched: filtering a few dozen rows should never
 * round-trip.
 *
 * The filter matches both the ITA title and any OIT titles under it, so a
 * search hit on a single OIT still shows the parent topic. A topic that
 * matches only by OIT title keeps just those OITs in the result.
 */
export function ItaSearchSection({ canManage }: { canManage: boolean }) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const requestedYear = searchParams.get("year");
  const yearParam = requestedYear && /^\d{4}$/.test(requestedYear) ? requestedYear : null;

  const [q, setQ] = useState("");
  const [years, setYears] = useState<string[]>([]);
  const [data, setData] = useState<{
    status: "loading" | "ready" | "error";
    year: string | null;
    entries: ItaAccordionEntry[];
  }>({ status: "loading", year: yearParam, entries: [] });

  const { status, year, entries } = data;

  // Both effects set state from a fetch callback, after the network answers —
  // never synchronously while the effect runs, which is the thing that cascades
  // renders. Each is guarded by an AbortController so a response for a year the
  // reader has already navigated away from cannot land.

  // Which years exist. Fetched once — the list only changes when staff file a
  // topic in a year nobody had used yet.
  useEffect(() => {
    const controller = new AbortController();
    fetchItaYears(controller.signal)
      .then((list) => {
        setYears(list);
      })
      .catch((error: unknown) => {
        if (!controller.signal.aborted) console.error("[ita-years]", error);
      });
    return () => controller.abort();
  }, []);

  // The year whose topics to show. Before the year list arrives this is the
  // current พ.ศ. (an empty database still renders a page); once it arrives,
  // the newest year that has data. Derived on purpose: when resolving the
  // list does not actually change the year — the common cold load, where the
  // current พ.ศ. is also the newest with data — the fetch effect below sees
  // an unchanged dep and does not run a second time. Keying the effect on the
  // resolved year (not on `years`) is what fetches it once instead of twice.
  const target = yearParam ?? years[0] ?? String(currentBEYear());

  // The year's topics. Runs only when the target year itself changes.
  useEffect(() => {
    const controller = new AbortController();

    fetchItasByYear(target, controller.signal)
      .then((rows) => {
        setData({ status: "ready", year: target, entries: rows });
      })
      .catch((error: unknown) => {
        if (controller.signal.aborted) return;
        console.error("[ita-by-year]", error);
        setData({ status: "error", year: target, entries: [] });
      });
    return () => controller.abort();
  }, [target]);

  const isSearching = q.trim().length > 0;

  const filtered = useMemo(() => {
    const qq = q.trim().toLowerCase();
    if (!qq) return entries;
    return entries
      .map((entry) => {
        const itaMatches = entry.title.toLowerCase().includes(qq);
        if (itaMatches) return entry;
        return {
          ...entry,
          oits: entry.oits.filter((o) => o.title.toLowerCase().includes(qq)),
        };
      })
      .filter(
        (entry) =>
          entry.title.toLowerCase().includes(qq) || entry.oits.length > 0,
      );
  }, [entries, q]);

  const totalOits = filtered.reduce((n, e) => n + e.oits.length, 0);

  return (
    <FeaturedSurface className="space-y-4 px-4 py-5 sm:px-6 sm:py-6">
      <div className="min-w-0 border-b border-stone-200 pb-4 dark:border-border/70">
        <WarmSectionHeading title="ข้อมูล ITA / OIT" />
        <h2 className="mt-1 text-xl font-bold tracking-tight text-warm dark:text-warm-strong sm:text-2xl">
          ITA ปี {year ?? "…"}
        </h2>
        <p className="mt-1 text-sm text-muted-foreground sm:text-base">
          ข้อมูลสาธารณะประจำปี {year ?? "…"}
        </p>
      </div>

      <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
        <div className="relative min-w-0 flex-1">
          <Search
            className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground"
            aria-hidden
          />
          <Input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="ค้นหาข้อ OIT หรือคีย์เวิร์ด..."
            className="h-9 pl-9 pr-9"
            aria-label="ค้นหารายการ ITA"
          />
          {isSearching && (
            <button
              type="button"
              onClick={() => setQ("")}
              aria-label="ล้างคำค้นหา"
              className="absolute right-1.5 top-1/2 grid size-8 -translate-y-1/2 cursor-pointer place-items-center rounded-md text-muted-foreground hover:bg-accent hover:text-foreground"
            >
              <X className="size-3.5" aria-hidden />
            </button>
          )}
        </div>

        <Select
          // "" (not undefined) so the select is controlled from the first
          // render — Radix shows the placeholder for "" either way, and
          // undefined → "2569" once data lands is what triggers React's
          // uncontrolled-to-controlled warning.
          value={year ?? ""}
          disabled={years.length === 0}
          onValueChange={(next) => {
            // No basePath — router.push prepends it. Stays on this page; the
            // effect above sees the new ?year= and fetches it. scroll:false
            // keeps the viewport on the ITA section — the reader is already
            // looking at it, jumping to the top would just make them scroll
            // back down.
            router.push(`/?year=${next}`, { scroll: false });
          }}
        >
          <SelectTrigger className="h-9 w-full shrink-0 sm:w-40" aria-label="เลือกปี พ.ศ.">
            <SelectValue placeholder="เลือกปี" />
          </SelectTrigger>
          <SelectContent>
            {years.map((y) => (
              <SelectItem key={y} value={y}>
                พ.ศ. {y}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {isSearching && (
        <p className="text-xs text-muted-foreground">
          พบ {filtered.length} หัวข้อ · {totalOits} รายการย่อย
        </p>
      )}

      {status === "loading" ? (
        <ul className="space-y-2" aria-busy>
          <li className="sr-only">กำลังโหลดข้อมูล…</li>
          {/* Placeholder rows rather than a spinner: the list settles into the
              same shape, so the page does not jump when the data lands. */}
          {[0, 1, 2].map((i) => (
            <li key={i} className="h-18.5 animate-pulse rounded-lg border bg-card" />
          ))}
        </ul>
      ) : status === "error" ? (
        <EmptyState
          icon={TriangleAlert}
          title="โหลดข้อมูล ITA ไม่สำเร็จ"
          description="อาจเป็นปัญหาการเชื่อมต่อชั่วคราว ลองโหลดหน้านี้ใหม่อีกครั้ง"
          action={
            <Button onClick={() => router.refresh()} variant="secondary">
              ลองใหม่อีกครั้ง
            </Button>
          }
        />
      ) : filtered.length === 0 ? (
        <EmptyState
          icon={ListChecks}
          title={isSearching ? "ไม่พบหัวข้อที่ตรงกับการค้นหา" : `ยังไม่มีหัวข้อ ITA ในปี พ.ศ. ${year}`}
          description={
            isSearching
              ? "ลองเปลี่ยนคำค้นหา หรือเลือกปีอื่น"
              : "ลองเลือกปีอื่นจากรายการด้านบน"
          }
          // Staff-only: "/ita-list" is ADMIN+ (decisions.md D12 amendment), so
          // for a visitor this button would just bounce to the login page.
          action={
            canManage ? (
              <Button asChild>
                <Link href="/ita-list">ไปจัดการรายการ ITA</Link>
              </Button>
            ) : undefined
          }
        />
      ) : (
        <ItaAccordion
          // Remount on year or search-mode change so the accordion's
          // defaultValue (first-only vs all-open) is re-applied. Manual
          // opens/closes between those events survive because nothing in
          // between causes a remount.
          key={`${year}-${isSearching ? "search" : "browse"}`}
          entries={filtered}
          isSearching={isSearching}
          canManage={canManage}
        />
      )}
    </FeaturedSurface>
  );
}
