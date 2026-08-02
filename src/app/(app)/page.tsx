import { Suspense } from "react";
import { ItaSearchSection } from "@/components/public/ita-search-section";
import { PublicHero } from "@/components/public/public-hero";
import { VideoSection } from "@/components/public/video-section";
import { hasRole } from "@/lib/auth/roles";
import { getSessionUser } from "@/lib/auth/session";

/**
 * Public landing page (decisions.md D12).
 *
 * Hero + latest faculty video, then the "ITA ปี …" section.
 *
 * **The ITA list is not fetched here.** `ItaSearchSection` reads it from the
 * Public API in the browser — a stakeholder requirement, and it means the page
 * everyone sees runs on the same contract the faculty website consumes, so a
 * change that breaks one breaks the other visibly instead of quietly.
 *
 * What is left on the server is what the API cannot answer: whether the person
 * looking is staff, which decides only whether the edit affordances render.
 * The Server Actions behind them check the role for themselves.
 *
 * Title uses the faculty orange rather than the neutral PageHeader — the public
 * landing page is the one place that should look like the marketing site, and
 * that brand colour is the Lovable prototype's clearest visual signature.
 */
export default async function HomePage() {
  const user = await getSessionUser();
  const canManage = hasRole(user, "ADMIN", "SUPERADMIN");

  return (
    <div className="space-y-4">
      <header className="flex flex-col items-center gap-1.5 py-2 text-center sm:py-3">
        <h1 className="text-2xl font-bold tracking-tight text-orange-500 sm:text-3xl">
          ระบบข้อมูลสาธารณะ
        </h1>
      </header>

      <div className="grid gap-4 lg:grid-cols-2 lg:gap-6">
        <PublicHero />
        <VideoSection />
      </div>

      {/* useSearchParams() needs a Suspense boundary above it, or the whole
          route opts out of static rendering. */}
      <Suspense>
        <ItaSearchSection canManage={canManage} />
      </Suspense>
    </div>
  );
}
