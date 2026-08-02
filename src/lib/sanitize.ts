import DOMPurify, { type Config } from "isomorphic-dompurify";

// HTML sanitising for Tiptap content (decisions.md D3 — DOMPurify, on save AND
// on display). Server-side only: `isomorphic-dompurify` supplies the DOM that
// plain `dompurify` lacks in Node, so the same rules apply in a Server Action
// and in a Server Component. Sanitising only on save would leave every row
// written before a rule change permanently trusted.

// Tiptap's own schema already limits what the editor can produce. This list is
// the second line of defence, for HTML that arrives some other way: pasted from
// another site, or POSTed straight to the Server Action.
const ALLOWED_TAGS = [
  "p",
  "br",
  "b",
  "strong",
  "i",
  "em",
  "u",
  "s",
  "ul",
  "ol",
  "li",
  "a",
  "span",
];

const CONFIG = {
  ALLOWED_TAGS,
  // `style` is allowed only because TextAlign writes `style="text-align:center"`.
  // DOMPurify keeps the declaration list as-is, so the hook below throws away
  // everything except text-align — verified: `background:url(javascript:…)`
  // survives DOMPurify itself.
  ALLOWED_ATTR: ["href", "target", "rel", "style", "class"],
  ALLOW_DATA_ATTR: false,
  // Blocks javascript: and data: URLs, while still allowing links to files in
  // this app, which are rooted paths like "/fonita/storage/itafile/…".
  //
  // `\/(?![/\\])` is the important part: one leading slash is a path on this
  // site, but "//evil.example" is a different site written to look relative —
  // and browsers normalise the backslash in "/\evil.example" to the same thing,
  // so both are excluded. Without the path branch here the file picker (F21)
  // produced <a> tags whose href was silently stripped on save — caught by
  // saving one and reading the row back.
  ALLOWED_URI_REGEXP: /^(?:https?:|mailto:|\/(?![/\\]))/i,
  FORBID_TAGS: ["script", "iframe", "object", "embed", "form", "input", "style"],
} satisfies Config;

// The only inline style the editor legitimately produces.
const TEXT_ALIGN = /^text-align:\s*(left|center|right|justify)$/i;

let hookInstalled = false;

function installHook() {
  if (hookInstalled) return;
  hookInstalled = true;

  DOMPurify.addHook("afterSanitizeAttributes", (node) => {
    // Any link that survives opens in a new tab without handing the opener
    // over — rel is forced here rather than trusted from the incoming markup.
    if (node.nodeName === "A") {
      node.setAttribute("target", "_blank");
      node.setAttribute("rel", "noopener noreferrer");
    }

    if (!node.hasAttribute?.("style")) return;

    // Whitelist one declaration instead of trusting the CSS parser. Without
    // this, `background:url(…)` and `position:fixed` overlays ride along inside
    // an attribute that only exists for alignment.
    const kept = (node.getAttribute("style") ?? "")
      .split(";")
      .map((d) => d.trim())
      .filter((d) => TEXT_ALIGN.test(d));

    if (kept.length > 0) {
      node.setAttribute("style", `${kept.join("; ")};`);
    } else {
      node.removeAttribute("style");
    }
  });
}

/** Clean HTML, safe to store and to render with dangerouslySetInnerHTML. */
export function sanitizeHtml(dirty: string | null | undefined): string {
  if (!dirty) return "";
  installHook();
  return DOMPurify.sanitize(dirty, CONFIG);
}

const ENTITIES: Record<string, string> = {
  "&amp;": "&",
  "&lt;": "<",
  "&gt;": ">",
  "&quot;": '"',
  "&#39;": "'",
  "&nbsp;": " ",
};

/**
 * The visible text, used for the character limit (F17 caps content at 1000).
 *
 * Sanitising with no tags allowed drops the markup properly — a regex strip
 * would mangle `<` inside text. It re-escapes entities on the way out, though,
 * so those are decoded here: otherwise `&` would count as the five characters
 * of `&amp;` and the editor's counter (which counts one) would disagree with
 * the server that rejects the text.
 */
export function htmlToText(html: string | null | undefined): string {
  if (!html) return "";
  const stripped = DOMPurify.sanitize(html, { ALLOWED_TAGS: [], ALLOWED_ATTR: [] });
  return stripped.replace(/&(?:amp|lt|gt|quot|#39|nbsp);/g, (m) => ENTITIES[m] ?? m).trim();
}
