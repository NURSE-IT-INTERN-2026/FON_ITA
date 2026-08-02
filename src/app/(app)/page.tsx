import { PublicHero } from "@/components/public/public-hero";
import { ItaSearchSection } from "@/components/public/ita-search-section";
import { VideoSection } from "@/components/public/video-section";
import { PageHeader } from "@/components/shell/page-header";
import { hasRole } from "@/lib/auth/roles";
import { getSessionUser } from "@/lib/auth/session";
import { currentBEYear } from "@/lib/date";
import { getItasByYear, listItaYears, yearOptions } from "@/lib/ita/queries";

// Allow the year filter to be cached per-year; the page stays dynamic for the
// `getSessionUser` check that decides whether edit buttons render.
export const dynamic = "force-dynamic";

type Props = {
  searchParams: Promise<{ year?: string }>;
};

/**
 * Public landing page (decisions.md D12).
 *
 * Hero + latest faculty video, then the "ITA ปี …" section. Year is read from
 * `?year=` so a visitor can bookmark or share a specific year's view; search is
 * client-only and never reaches the server. Falls back to the most recent year
 * that has data, matching how `/ita-list` handles a current year with no rows.
 */
export default async function HomePage({ searchParams }: Props) {
  const { year: yearParam } = await searchParams;

  const availableYears = await listItaYears();
  const fallbackYear = availableYears[0] ?? String(currentBEYear());
  const year =
    yearParam && /^\d{4}$/.test(yearParam) ? yearParam : fallbackYear;

  const [itas, user] = await Promise.all([
    getItasByYear(year),
    getSessionUser(),
  ]);

  const years = yearOptions(availableYears, year, String(currentBEYear()));

  return (
    <div className="space-y-6">
      <PageHeader
        title="ระบบจัดการข้อมูลสาธารณะ"
        description={`ข้อมูลการประเมินคุณธรรมและความโปร่งใส คณะพยาบาลศาสตร์ มหาวิทยาลัยเชียงใหม่`}
      />

      <div className="grid gap-4 lg:grid-cols-2 lg:gap-6">
        <PublicHero />
        <VideoSection />
      </div>

      <ItaSearchSection
        year={year}
        years={years}
        entries={itas}
        canManage={hasRole(user, "ADMIN", "SUPERADMIN")}
      />
    </div>
  );
}
