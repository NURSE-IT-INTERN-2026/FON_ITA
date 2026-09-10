import type { Metadata } from "next";
import { ItaListView } from "@/components/ita/ita-list-view";
import { requireRole } from "@/lib/auth/guards";
import { currentBEYear } from "@/lib/date";
import { getItasByYear, listItaYears, yearOptions } from "@/lib/ita/queries";

export const metadata: Metadata = { title: "รายการ ITA — FON-ITA" };

/**
 * The ITA landing page: the newest year that has data (decisions.md D9,
 * amended 10 ก.ย. 2569).
 *
 * Staff start filing next year's topics before the calendar turns, so "which
 * year is it" must not decide what this page shows — the newest year with
 * anything in it does. Only an empty database falls back to the current พ.ศ.
 * year, so the page still has a year to show the empty state for.
 */
export default async function ItaListPage() {
  // Staff working view (decisions.md D12 amendment) — the proxy is the first
  // gate, this is the real one. Visitors read the same data on `/`.
  await requireRole("ADMIN", "SUPERADMIN");

  // listItaYears() is newest-first, so years[0] is the newest year with data.
  const years = await listItaYears();
  const year = years[0] ?? String(currentBEYear());

  const itas = await getItasByYear(year);

  return (
    <ItaListView
      year={year}
      years={yearOptions(years, year)}
      itas={itas}
      breadcrumb={[{ label: "หน้าแรก", href: "/" }, { label: "รายการ ITA" }]}
      canManage
    />
  );
}
