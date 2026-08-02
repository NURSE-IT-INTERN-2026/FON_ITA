import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { ItaListView } from "@/components/ita/ita-list-view";
import { hasRole } from "@/lib/auth/roles";
import { getSessionUser } from "@/lib/auth/session";
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
  // Public page (decisions.md D12) — `user` is null for a visitor who is not
  // signed in, which only decides whether the management controls are drawn.
  const user = await getSessionUser();

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
