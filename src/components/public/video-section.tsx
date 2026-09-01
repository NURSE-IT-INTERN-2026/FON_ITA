import { FeaturedSurface } from "@/components/shell/surfaces";

/**
 * Featured video on the home page.
 *
 * Hardcoded by editorial choice — the faculty pins a specific clip rather than
 * whichever the YouTube feed happens to return first. Change `FEATURED_VIDEO_ID`
 * below to swap it; the embed and the API route are independent so this does
 * not affect `/api/nurse/youtube-feed`.
 *
 * `youtube-nocookie.com` gives the privacy-aware embed mode; viewers never get
 * a YouTube cookie just from loading the home page.
 *
 * Layout matches the hero exactly — same `aspect-video` + `max-h-[230px]` on
 * mobile and `h-full` on lg — so the two grid cells share a row at the same
 * height. `mt-auto` is a no-op on mobile (the section is exactly the iframe's
 * height) and on lg (the iframe fills the section); it exists only to absorb
 * any stray stretch without misplacing the iframe.
 */
const FEATURED_VIDEO_ID = "NTdqTESI8Lk";

export function VideoSection() {
  return (
    <FeaturedSurface className="mx-auto w-full max-w-4xl p-3 shadow-[0_30px_70px_-46px_rgba(67,36,19,0.42)] dark:shadow-[0_30px_72px_-46px_rgba(0,0,0,0.76)] sm:p-4">
      <div className="overflow-hidden rounded-[22px] bg-black">
        <iframe
          src={`https://www.youtube-nocookie.com/embed/${FEATURED_VIDEO_ID}`}
          title="วิดีโอแนะนำระบบ"
          loading="lazy"
          allow="accelerometer; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
          allowFullScreen
          className="aspect-video w-full border-0"
        />
      </div>
    </FeaturedSurface>
  );
}
