import { legacyHeaders, tooManyRequests } from "@/lib/api/legacy-response";
import { clientKey, consumeRateLimit } from "@/lib/api/rate-limit";

/**
 * GET /api/nurse/youtube-feed  (real path: /fonita/api/nurse/youtube-feed)
 *
 * FROZEN contract — see docs/chapters/05-public-api.md §6.2. Proxies the
 * faculty YouTube channel's Atom feed and returns the two newest videos.
 *
 * The proxy exists because the browser cannot read youtube.com's feed directly:
 * it sends no CORS headers. The response shape is whatever PHP's
 * `json_encode(simplexml_load_string(...))` produced, quirks included.
 */

const CHANNEL_ID = "UCrsvXl143w91ND6BjGn9cZw";
const FEED_URL = `https://www.youtube.com/feeds/videos.xml?channel_id=${CHANNEL_ID}`;
const ENTRY_COUNT = 2;

// Narrower than /api/v1/ita, which answers "*". Matched to the live system.
const CORS_ORIGIN = "https://www.nurse.cmu.ac.th";
const CORS_METHODS = "GET";
const CORS_HEADERS = "X-Requested-With, Content-Type, X-Token-Auth, Authorization";

/**
 * One feed entry in the legacy shape.
 *
 * `link` and `author` are objects, not strings: SimpleXML represents a childless
 * element's attributes under the key `@attributes`, and json_encode carried that
 * straight through. The faculty page reads `item.link['@attributes'].href`, so
 * flattening these to strings would break it.
 */
type FeedEntry = {
  id: string;
  title: string;
  link: { "@attributes": Record<string, string> };
  author: { name: string; uri: string };
  published: string;
  updated: string;
};

export async function GET(request: Request) {
  const rate = consumeRateLimit(clientKey(request));
  if (!rate.allowed) return tooManyRequests(rate, CORS_ORIGIN);

  const entries = await loadFeed();

  const headers = legacyHeaders(rate, CORS_ORIGIN);
  headers.set("Access-Control-Allow-Methods", CORS_METHODS);
  headers.set("Access-Control-Allow-Headers", CORS_HEADERS);

  return new Response(JSON.stringify(entries), { status: 200, headers });
}

/**
 * Fetch and parse, or give up quietly.
 *
 * Every failure path — YouTube down, timeout, unexpected markup — ends in an
 * empty array with HTTP 200, because this feed is decoration on the faculty
 * home page. An error status would put a broken widget in front of visitors
 * over something no one here controls.
 */
async function loadFeed(): Promise<FeedEntry[]> {
  try {
    const response = await fetch(FEED_URL, {
      // A slow upstream must not hold our own request open.
      signal: AbortSignal.timeout(5_000),
      // The feed changes a few times a month; this keeps a burst of visitors
      // from turning into a burst of requests to YouTube. The response we send
      // the browser is still marked no-cache, exactly as before.
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
function parseFeed(xml: string): FeedEntry[] {
  const blocks = xml.match(/<entry>[\s\S]*?<\/entry>/g) ?? [];

  return blocks
    .slice(0, ENTRY_COUNT)
    .map(parseEntry)
    .filter((entry): entry is FeedEntry => entry !== null);
}

function parseEntry(block: string): FeedEntry | null {
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

export function OPTIONS() {
  return new Response(null, {
    status: 204,
    headers: {
      "Access-Control-Allow-Origin": CORS_ORIGIN,
      "Access-Control-Allow-Methods": CORS_METHODS,
      "Access-Control-Allow-Headers": CORS_HEADERS,
    },
  });
}
