import { loadYoutubeFeed, youTubeVideoId } from "@/lib/youtube/feed";

/**
 * Latest video from the faculty YouTube channel, sized to sit beside the hero
 * on the home page.
 *
 * Server Component — the data is fetched through the same lib the frozen
 * `/api/nurse/youtube-feed` route uses, so the page and the public API never
 * drift apart. `loadYoutubeFeed` degrades to an empty array on any upstream
 * failure, and an empty list renders nothing rather than a broken placeholder.
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
export async function VideoSection() {
  const entries = await loadYoutubeFeed();
  const latest = entries[0];
  if (!latest) return null;

  const videoId = youTubeVideoId(latest);

  return (
    <section className="flex h-full flex-col overflow-hidden rounded-xl border bg-card">
      <div className="mt-auto w-full aspect-video max-h-[230px] overflow-hidden rounded-xl bg-black lg:aspect-auto lg:h-full">
        <iframe
          src={`https://www.youtube-nocookie.com/embed/${videoId}`}
          title={latest.title}
          loading="lazy"
          allow="accelerometer; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
          allowFullScreen
          className="h-full w-full border-0"
        />
      </div>
    </section>
  );
}
