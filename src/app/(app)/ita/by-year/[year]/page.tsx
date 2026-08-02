import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { ItaListView } from "@/components/ita/ita-list-view";
import { requireUser } from "@/lib/auth/guards";
import { currentBEYear } from "@/lib/date";
import { getItasByYear, listItaYears, yearOptions } from "@/lib/ita/queries";

type Props = { params: Promise<{ year: string }> };

// A พ.ศ. year is always four digits. Anything else is a bad URL, not an empty
// result — and validating it keeps arbitrary strings out of the page title.
const YEAR_PATTERN = /^\d{4}$/;

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { year } = await params;
  if (!YEAR_PATTERN.test(year)) return { title: "ไม่พบหน้า — FON-ITA" };
  return { title: `รายการ ITA ปี พ.ศ. ${year} — FON-ITA` };
}

/** ITA topics for one พ.ศ. year — the URL staff bookmark (decisions.md D9). */
export default async function ItaByYearPage({ params }: Props) {
  await requireUser();

  const { year } = await params;
  if (!YEAR_PATTERN.test(year)) notFound();

  // A year with no rows renders the empty state rather than redirecting: the
  // user asked for this year explicitly, and silently moving them elsewhere
  // would look like the link was broken.
  const [years, itas] = await Promise.all([listItaYears(), getItasByYear(year)]);

  return (
    <ItaListView
      year={year}
      years={yearOptions(years, year, String(currentBEYear()))}
      itas={itas}
      breadcrumb={[
        { label: "หน้าแรก", href: "/" },
        { label: "รายการ ITA", href: "/ita-list" },
        { label: `ปี พ.ศ. ${year}` },
      ]}
    />
  );
}
