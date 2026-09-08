// Faculty YouTube feed (F28). The route handler at /api/nurse/youtube-feed is
// the *frozen* external contract, and the home page renders the same data — so
// the fetch + parse lives here and both call sites share it.

const CHANNEL_ID = process.env.YOUTUBE_CHANNEL_ID ?? "UCrsvXl143w91ND6BjGn9cZw";
const FEED_URL = `https://www.youtube.com/feeds/videos.xml?channel_id=${CHANNEL_ID}`;
export const YOUTUBE_FEED_ENTRY_COUNT = 2;

/**
 * One feed entry in the legacy shape.
 *
 * `link` and `author` are objects, not strings: SimpleXML represents a childless
 * element's attributes under the key `@attributes`, and json_encode carried that
 * straight through. The faculty page reads `item.link['@attributes'].href`, so
 * the route handler must keep it. The home page can use the parsed helpers below
 * instead.
 */
export type YoutubeFeedEntry = {
  id: string;
  title: string;
  link: { "@attributes": Record<string, string> };
  author: { name: string; uri: string };
  published: string;
  updated: string;
};

/**
 * Fetch and parse, or give up quietly.
 *
 * Every failure path — YouTube down, timeout, unexpected markup — ends in an
 * empty array, because this feed is decoration on the faculty home page. An
 * error status would put a broken widget in front of visitors over something no
 * one here controls. The route handler returns 200 with `[]` for the same
 * reason.
 */
export async function loadYoutubeFeed(): Promise<YoutubeFeedEntry[]> {
  try {
    const response = await fetch(FEED_URL, {
      // A slow upstream must not hold our own request open.
      signal: AbortSignal.timeout(5_000),
      // The feed changes a few times a month; this keeps a burst of visitors
      // from turning into a burst of requests to YouTube.
      next: { revalidate: 300 },
    });
    if (!response.ok) {
      console.error("[youtube-feed] upstream returned", response.status);
      return [];
    }
    return parseFeed(await response.text());
  } catch (error) {
    console.error("[youtube-feed] fetch failed", error);
    return [];
  }
}

/**
 * Minimal Atom reader for this one feed.
 *
 * Hand-written rather than pulling in an XML parser: the source is a single
 * fixed-format document from one publisher, and six fields are needed from it.
 * Anything that does not match is skipped, so a change upstream degrades to
 * fewer entries instead of a 500.
 */
function parseFeed(xml: string): YoutubeFeedEntry[] {
  const blocks = xml.match(/<entry>[\s\S]*?<\/entry>/g) ?? [];

  return blocks
    .slice(0, YOUTUBE_FEED_ENTRY_COUNT)
    .map(parseEntry)
    .filter((entry): entry is YoutubeFeedEntry => entry !== null);
}

function parseEntry(block: string): YoutubeFeedEntry | null {
  // <media:group> repeats <title> and other names further down. Cutting the
  // block there keeps the first-match lookups below unambiguous.
  const head = block.split("<media:group>")[0];

  const id = tagText(head, "id");
  const title = tagText(head, "title");
  const published = tagText(head, "published");
  const updated = tagText(head, "updated");

  const linkTag = head.match(/<link\b([^>]*)\/?>/);
  const authorBlock = head.match(/<author>([\s\S]*?)<\/author>/);

  if (id === null || title === null || !linkTag || !authorBlock) return null;

  return {
    id,
    title,
    link: { "@attributes": parseAttributes(linkTag[1]) },
    author: {
      name: tagText(authorBlock[1], "name") ?? "",
      uri: tagText(authorBlock[1], "uri") ?? "",
    },
    // Passed through verbatim: the feed writes `+00:00`, and so did the old
    // response — unlike the ITA timestamps, which end in `Z`.
    published: published ?? "",
    updated: updated ?? "",
  };
}

/** Text of the first `<name>…</name>`, entity-decoded. `null` when absent. */
function tagText(xml: string, name: string): string | null {
  const match = xml.match(new RegExp(`<${name}>([\\s\\S]*?)</${name}>`));
  return match ? decodeEntities(match[1].trim()) : null;
}

/** Attributes in document order, which is the order SimpleXML preserved. */
function parseAttributes(source: string): Record<string, string> {
  const attributes: Record<string, string> = {};
  for (const match of source.matchAll(/([\w:-]+)\s*=\s*"([^"]*)"/g)) {
    attributes[match[1]] = decodeEntities(match[2]);
  }
  return attributes;
}

const NAMED_ENTITIES: Record<string, string> = {
  "&amp;": "&",
  "&lt;": "<",
  "&gt;": ">",
  "&quot;": '"',
  "&apos;": "'",
};

/**
 * Video titles routinely contain `&amp;` and `&#39;`. SimpleXML decoded these
 * before json_encode saw them, so the JSON carried the real characters.
 */
function decodeEntities(text: string): string {
  return text
    .replace(/&#(\d+);/g, (_, code: string) => String.fromCodePoint(Number(code)))
    .replace(/&#x([0-9a-f]+);/gi, (_, code: string) => String.fromCodePoint(parseInt(code, 16)))
    // Ampersand last, so `&amp;#39;` does not turn into a character.
    .replace(/&(?:lt|gt|quot|apos|amp);/g, (entity) => NAMED_ENTITIES[entity] ?? entity);
}
