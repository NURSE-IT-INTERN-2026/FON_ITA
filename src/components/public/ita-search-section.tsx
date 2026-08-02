"use client";

import { ListChecks, Search, X } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";
import { ItaAccordion, type ItaAccordionEntry } from "@/components/public/ita-accordion";
import { EmptyState } from "@/components/misc/empty-state";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

/**
 * Public "ITA ปี …" section on the home page: year picker + search box +
 * accordion of matching topics.
 *
 * Year is in the URL (/?year=2568) so the server component re-renders with that
 * year's data — the picker just calls `router.push`. Search is pure client
 * state, filtered against the rows the server already sent: a search box for a
 * few dozen rows should never round-trip.
 *
 * The filter matches both the ITA title and any OIT titles under it, so a
 * search hit on a single OIT still shows the parent topic. A topic that
 * matches only by OIT title keeps just those OITs in the result.
 */
export function ItaSearchSection({
  year,
  years,
  entries,
  canManage,
}: {
  year: string;
  years: string[];
  entries: ItaAccordionEntry[];
  canManage: boolean;
}) {
  const router = useRouter();
  const [q, setQ] = useState("");

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
    <section className="space-y-3">
      <div className="min-w-0 border-b pb-3">
        <h2 className="text-xl font-bold tracking-tight sm:text-2xl">
          ITA ปี {year}
        </h2>
        <p className="mt-1 text-sm text-muted-foreground">
          ข้อมูลการประเมินคุณธรรมและความโปร่งใส ประจำปี พ.ศ. {year}
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
              className="absolute right-2 top-1/2 grid size-6 -translate-y-1/2 place-items-center rounded-md text-muted-foreground hover:bg-accent hover:text-foreground"
            >
              <X className="size-3.5" aria-hidden />
            </button>
          )}
        </div>

        <Select
          value={year}
          onValueChange={(next) => {
            // No basePath — router.push prepends it. Stays on the landing page,
            // the server component re-renders with the new year's rows.
            router.push(`/?year=${next}`);
          }}
        >
          <SelectTrigger className="h-9 w-full shrink-0 sm:w-[160px]" aria-label="เลือกปี พ.ศ.">
            <SelectValue />
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

      {filtered.length === 0 ? (
        <EmptyState
          icon={ListChecks}
          title={isSearching ? "ไม่พบหัวข้อที่ตรงกับการค้นหา" : `ยังไม่มีหัวข้อ ITA ในปี พ.ศ. ${year}`}
          description={
            isSearching
              ? "ลองเปลี่ยนคำค้นหา หรือเลือกปีอื่น"
              : "ลองเลือกปีอื่นจากรายการด้านบน"
          }
          action={
            <Button asChild variant="secondary">
              <Link href="/ita-list">ไปจัดการรายการ ITA</Link>
            </Button>
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
    </section>
  );
}
