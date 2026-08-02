import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { ItaListView } from "@/components/ita/ita-list-view";
import { requireUser } from "@/lib/auth/guards";
import { hasRole } from "@/lib/auth/roles";
import { currentBEYear } from "@/lib/date";
import { getItasByYear, listItaYears, yearOptions } from "@/lib/ita/queries";

export const metadata: Metadata = { title: "รายการ ITA — FON-ITA" };

/**
 * The ITA landing page: the current พ.ศ. year (decisions.md D9).
 *
 * When the current year has nothing in it yet — which is every year until
 * someone files the first topic — fall through to the most recent year that
 * does, so staff land on real data instead of an empty page.
 */
export default async function ItaListPage() {
  // Guard before querying: the layout guards too, but a page is its own entry
  // point and must not do work for a request that is about to be rejected.
  const user = await requireUser();

  const year = String(currentBEYear());
  const years = await listItaYears();

  // No years at all → stay here and show the empty state; redirecting would
  // have nowhere to go.
  if (years.length > 0 && !years.includes(year)) redirect(`/ita/by-year/${years[0]}`);

  const itas = await getItasByYear(year);

  return (
    <ItaListView
      year={year}
      years={yearOptions(years, year)}
      itas={itas}
      breadcrumb={[{ label: "หน้าแรก", href: "/" }, { label: "รายการ ITA" }]}
      canManage={hasRole(user, "ADMIN", "SUPERADMIN")}
    />
  );
}
