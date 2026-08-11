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
    <div className="space-y-6 pb-8 sm:space-y-8 lg:space-y-10 lg:pb-12">
      <section className="relative left-1/2 right-1/2 mx-[-50vw] w-screen border-b border-stone-200 bg-linear-to-b from-[#f6f4f2] via-white to-[#f4f1ef] shadow-[0_18px_45px_-38px_rgba(84,52,28,0.45)]">
        <div className="mx-auto max-w-[1800px]">
          <PublicHero />
        </div>
      </section>

      <section className="mx-auto w-full max-w-5xl space-y-4 px-1 sm:px-0">
        <header className="border-b border-stone-200 pb-4">
        
          <h1 className="mt-2 text-2xl font-bold tracking-tight text-[#b8774c] sm:text-3xl">
            ระบบข้อมูลสาธารณะ
          </h1>
         
        </header>

        <VideoSection />
      </section>

      <section className="mx-auto w-full max-w-5xl scroll-mt-24 px-1 sm:px-0">
        {/* useSearchParams() needs a Suspense boundary above it, or the whole
            route opts out of static rendering. */}
        <Suspense>
          <ItaSearchSection canManage={canManage} />
        </Suspense>
      </section>
    </div>
  );
}
