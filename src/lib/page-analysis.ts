// What a crawler that doesn't run JavaScript would see in a page's HTML, and what the page tells crawlers.
// Pure text in, answers out.

export interface PageAnalysis {
  title: string | null;
  description: string | null;
  canonical: string | null;
  h1Count: number;
  /** Words of visible text in the HTML itself, before any JavaScript runs. */
  words: number;
  scripts: number;
  jsonLd: number;
  /** An empty container that a script fills in, like <div id="root">. */
  hasAppRoot: boolean;
  /** The page says it needs JavaScript. */
  needsJsMessage: boolean;
  /** Crawler instructions from meta tags, as { name: "robots" | "googlebot" | ..., directives: ["noindex", ...] }. */
  metaRobots: { name: string; directives: string[] }[];
}

const ENTITIES: Record<string, string> = { amp: "&", lt: "<", gt: ">", quot: '"', apos: "'", nbsp: " ", ndash: "-", mdash: "-", hellip: "…", rsquo: "'", lsquo: "'" };

export function decodeEntities(text: string): string {
  return text.replace(/&(#x[0-9a-f]+|#\d+|[a-z]+);/gi, (whole, code: string) => {
    if (code[0] === "#") {
      const n = code[1].toLowerCase() === "x" ? parseInt(code.slice(2), 16) : parseInt(code.slice(1), 10);
      return Number.isFinite(n) && n > 0 && n < 0x110000 ? String.fromCodePoint(n) : " ";
    }
    return ENTITIES[code.toLowerCase()] ?? whole;
  });
}

const squash = (s: string) => decodeEntities(s).replace(/\s+/g, " ").trim();

function attributes(tag: string): Record<string, string> {
  const out: Record<string, string> = {};
  for (const m of tag.matchAll(/([a-zA-Z_:][-a-zA-Z0-9_:.]*)\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s"'>]+))/g)) {
    out[m[1].toLowerCase()] = m[2] ?? m[3] ?? m[4] ?? "";
  }
  return out;
}

/** The meta tag names whose instructions can affect search or AI tools. */
const ROBOTS_META_NAMES = /^(robots|googlebot|bingbot|oai-searchbot|chatgpt-user|gptbot|claudebot|claude-searchbot|claude-user|perplexitybot|perplexity-user)$/;

export function analyzeHtml(html: string): PageAnalysis {
  const metas = [...html.matchAll(/<meta\b[^>]*>/gi)].map((m) => attributes(m[0]));
  const description = metas.find((a) => a.name?.toLowerCase() === "description")?.content;
  const metaRobots = metas
    .filter((a) => a.name && ROBOTS_META_NAMES.test(a.name.toLowerCase()) && a.content !== undefined)
    .map((a) => ({
      name: a.name.toLowerCase(),
      directives: a.content
        .toLowerCase()
        .split(",")
        .map((d) => d.trim())
        .filter(Boolean),
    }));

  const title = /<title\b[^>]*>([\s\S]*?)<\/title>/i.exec(html)?.[1];
  const canonical = [...html.matchAll(/<link\b[^>]*>/gi)].map((m) => attributes(m[0])).find((a) => a.rel?.toLowerCase().split(/\s+/).includes("canonical"))?.href;

  // What's left after taking out everything a person wouldn't read: scripts, styles, the head, comments.
  const body = html
    .replace(/<!--[\s\S]*?-->/g, " ")
    .replace(/<(script|style|noscript|template|svg|head)\b[\s\S]*?<\/\1\s*>/gi, " ");
  const text = squash(body.replace(/<[^>]+>/g, " "));
  const words = text.split(" ").filter((w) => /[\p{L}\p{N}]/u.test(w)).length;

  return {
    title: title ? squash(title).slice(0, 200) || null : null,
    description: description ? squash(description).slice(0, 400) || null : null,
    canonical: canonical?.slice(0, 300) ?? null,
    h1Count: (body.match(/<h1\b/gi) ?? []).length,
    words,
    scripts: (html.match(/<script\b/gi) ?? []).length,
    jsonLd: (html.match(/<script\b[^>]*type\s*=\s*["']application\/ld\+json["']/gi) ?? []).length,
    hasAppRoot: /<div\b[^>]*\bid\s*=\s*["'](root|__next|app|__nuxt|svelte)["']/i.test(html),
    needsJsMessage: /(enable|requires?|needs?) javascript|javascript (is|must be) (required|enabled)/i.test(html),
    metaRobots,
  };
}

/** The crawler instructions in an X-Robots-Tag header, as the same shape as the meta tags. */
const DIRECTIVE_NAMES = new Set([
  "all", "noindex", "nofollow", "none", "noarchive", "nosnippet", "notranslate", "noimageindex", "indexifembedded",
  "unavailable_after", "max-snippet", "max-image-preview", "max-video-preview",
]);

export function parseXRobotsTag(value: string | string[] | undefined): { name: string; directives: string[] }[] {
  const values = Array.isArray(value) ? value : value ? [value] : [];
  const out: { name: string; directives: string[] }[] = [];
  for (const v of values) {
    // "googlebot: noindex, nofollow" is for one crawler; "noindex" alone is for all. Directives with their own colon
    // ("max-snippet: 50", "unavailable_after: date") aren't crawler names.
    const m = /^\s*([a-z0-9_-]+)\s*:\s*(.+)$/i.exec(v);
    const scoped = m && !DIRECTIVE_NAMES.has(m[1].toLowerCase());
    out.push({
      name: scoped ? m[1].toLowerCase() : "robots",
      directives: (scoped ? m[2] : v)
        .toLowerCase()
        .split(",")
        .map((d) => d.trim())
        .filter(Boolean),
    });
  }
  return out;
}

/** Which crawlers are told `noindex` (or `none`), as lower-case names, with "robots" meaning all of them. */
export function noindexTargets(instructions: { name: string; directives: string[] }[]): string[] {
  return [...new Set(instructions.filter((i) => i.directives.some((d) => d === "noindex" || d === "none")).map((i) => i.name))];
}
