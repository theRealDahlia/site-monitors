import { AI_BOTS, type AiBot, type AiResult, type AiStatus, type BotResult, type Finding, type ProbeState, type RobotsState } from "./ai-bots";
import { analyzeHtml, noindexTargets, parseXRobotsTag } from "./page-analysis";
import { type ParsedRobots, isAllowed, parseRobots } from "./robots";
import { type FetchResult, type Fetcher, FetchError, safeFetch } from "./safe-fetch";
import { SITE_URL } from "./site-url";

// Can AI search tools read this site? Everything here is something we can actually see from outside:
//  1. robots.txt: does it turn away the crawlers that build AI search indexes?
//  2. A request that looks like those crawlers: does the server answer it, or does a firewall turn it away?
//  3. The page's own HTML: is there text in it, or does it only appear after JavaScript runs? Is it marked "noindex"?
// What we can't see, and say so: whether a firewall checks a crawler's network address rather than its name,
// and whether any AI tool actually quotes the site. This is a check of access, never a promise about results.

const CHECKER_UA = `Mozilla/5.0 (compatible; SiteMonitors-AICheck/1.0; +${SITE_URL})`;
/** A request that carries a crawler's name, without pretending to be that company's crawler. Rules that match on the name still match. */
const probeUa = (token: string) => `Mozilla/5.0 (compatible; ${token}-test; Site Monitors AI access check; +${SITE_URL})`;

/** The crawlers we send a look-alike request for: the three AI search crawlers, plus the best-known training one. */
const PROBE_TOKENS = ["OAI-SearchBot", "Claude-SearchBot", "PerplexityBot", "GPTBot"];
/** HTTP answers that mean "we won't serve you". 429 and the like are "slow down", which proves nothing. */
const REFUSED = new Set([401, 403, 406, 451]);

const PAGE_BYTES = 1_000_000;
const SMALL_BYTES = 512 * 1024;
/** Two paths to test in robots.txt: the home page, and a page deeper in the site. */
const SAMPLE_PATHS = ["/", "/blog/sample-page"];

export interface Deps {
  fetch?: Fetcher;
  sleep?: (ms: number) => Promise<void>;
  now?: () => number;
}

const botByToken = (token: string) => AI_BOTS.find((b) => b.token === token) as AiBot;
const names = (tokens: string[]) => tokens.join(", ");
const searchTokens = AI_BOTS.filter((b) => b.role === "search").map((b) => b.token);

function unknown(checkedAt: number, error: string): AiResult {
  return { v: 1, checkedAt, status: "unknown", error, problemSig: "", page: null, robots: null, bots: [], extras: { sitemap: null, llmsTxt: null }, findings: [] };
}

function robotsState(parsed: ParsedRobots, token: string): RobotsState {
  const open = SAMPLE_PATHS.map((p) => isAllowed(parsed, token, p));
  if (open.every((o) => !o)) return "blocked";
  return open.some((o) => !o) ? "partial" : "allowed";
}

function classifyProbe(res: FetchResult): ProbeState {
  if (REFUSED.has(res.status) || res.headers["cf-mitigated"]) return "blocked";
  if (res.status === 429) return "limited";
  return res.status < 400 ? "ok" : "error";
}

export async function runAiVisibility(host: string, deps: Deps = {}): Promise<AiResult> {
  const get = deps.fetch ?? safeFetch;
  const sleep = deps.sleep ?? ((ms: number) => new Promise<void>((r) => setTimeout(r, ms)));
  const checkedAt = (deps.now ?? Date.now)();
  const base = `https://${host}`;
  const fetchPath = (path: string, userAgent: string, maxBytes: number) => get(`${base}${path}`, { userAgent, maxBytes });

  // 1. The home page as an ordinary, honest crawler sees it. If we can't read it, we can't judge anything.
  let home: FetchResult;
  try {
    home = await fetchPath("/", CHECKER_UA, PAGE_BYTES);
  } catch (err) {
    return unknown(checkedAt, `We couldn't open the site (${err instanceof FetchError ? err.message : "connection failed"}).`);
  }
  if (home.status >= 400) {
    return unknown(
      checkedAt,
      `Your server answered our check with HTTP ${home.status}, so we couldn't read the page. If a firewall is turning us away, it may be turning AI crawlers away too.`,
    );
  }

  // 2. robots.txt. A missing file (404) means no limits. A server error is treated by many crawlers as "don't crawl".
  let robotsFile: AiResult["robots"] = { state: "unreachable", httpStatus: null, sitemaps: 0 };
  let parsed: ParsedRobots | null = null;
  try {
    const r = await fetchPath("/robots.txt", CHECKER_UA, SMALL_BYTES);
    if (r.status >= 500) robotsFile = { state: "error", httpStatus: r.status, sitemaps: 0 };
    else if (r.status >= 400 || r.status >= 300) robotsFile = { state: "missing", httpStatus: r.status, sitemaps: 0 };
    else {
      parsed = parseRobots(r.body);
      robotsFile = { state: "found", httpStatus: r.status, sitemaps: parsed.sitemaps.length };
    }
  } catch {
    // Left as "unreachable": we can't say what robots.txt would have told crawlers.
  }

  const bots: BotResult[] = AI_BOTS.map((b) => ({
    token: b.token,
    robots: robotsFile?.state === "found" && parsed ? robotsState(parsed, b.token) : robotsFile?.state === "missing" ? "allowed" : "unknown",
  }));

  // 3. The same home page, asked for the way an AI search crawler would. One at a time and not too fast, so we don't trip a rate limit ourselves.
  for (const token of PROBE_TOKENS) {
    await sleep(400);
    const bot = bots.find((b) => b.token === token) as BotResult;
    try {
      const res = await fetchPath("/", probeUa(token), 64 * 1024);
      bot.probe = classifyProbe(res);
      bot.probeStatus = res.status;
    } catch (err) {
      // A connection cut off when we say we're a crawler, but not otherwise, is how some firewalls turn crawlers away.
      bot.probe = err instanceof FetchError && err.code === "ECONNRESET" ? "blocked" : "error";
      bot.probeStatus = null;
    }
  }

  // 4. The page itself.
  const contentType = String(home.headers["content-type"] ?? "");
  const isHtml = /html/i.test(contentType) || /<html|<!doctype html/i.test(home.body.slice(0, 2000));
  const analysis = isHtml ? analyzeHtml(home.body) : null;
  const instructions = [...(analysis?.metaRobots ?? []), ...parseXRobotsTag(home.headers["x-robots-tag"])];
  const searchNames = new Set([...searchTokens.map((t) => t.toLowerCase()), "bingbot"]);
  const noindexFor = noindexTargets(instructions).filter((n) => n === "robots" || searchNames.has(n));

  let readable: "readable" | "limited" | "empty" = "readable";
  if (analysis) {
    // A few words and a script isn't enough: plenty of plain pages carry an analytics script. We need a sign of an
    // app that fills the page in later (an empty container, or a "please enable JavaScript" message), or no text at all.
    const reliesOnJs = analysis.hasAppRoot || analysis.needsJsMessage || (analysis.words < 10 && analysis.scripts > 0);
    if (analysis.words < 30 && reliesOnJs) readable = "empty";
    else if (analysis.words < 120 && (analysis.hasAppRoot || analysis.needsJsMessage)) readable = "limited";
  }

  // 5. Helpful extras: a sitemap, and the optional llms.txt.
  // true: found and it looks like a sitemap. false: confirmed missing or broken. null: we couldn't tell, because the
  // server turned us away or didn't answer, which says nothing about whether the sitemap exists.
  const listedSitemap = parsed?.sitemaps[0] ?? null;
  const sitemapUrl = listedSitemap ?? `${base}/sitemap.xml`;
  let sitemap: boolean | null = null;
  let sitemapStatus: number | null = null;
  try {
    const r = await get(sitemapUrl, { userAgent: CHECKER_UA, maxBytes: 64 * 1024, accept: "application/xml,text/xml,*/*;q=0.5" });
    sitemapStatus = r.status;
    const looksRight = /<urlset|<sitemapindex/i.test(r.body) || (/\.gz($|\?)/i.test(sitemapUrl) && r.status < 300); // a compressed sitemap can't be read here
    if (r.status < 300) sitemap = looksRight ? true : false;
    else if (r.status === 404 || r.status === 410) sitemap = false;
  } catch {
    sitemap = null;
  }
  let llmsTxt: boolean | null = null;
  try {
    const r = await fetchPath("/llms.txt", CHECKER_UA, 64 * 1024);
    llmsTxt = r.status < 300 && r.body.trim().length > 0 && !/<html|<!doctype/i.test(r.body.slice(0, 500));
  } catch {
    llmsTxt = null;
  }

  // ---------- turn what we saw into findings ----------
  const findings: Finding[] = [];
  const add = (f: Finding) => findings.push(f);

  const blockedIn = (role: AiBot["role"]) => bots.filter((b) => botByToken(b.token).role === role && b.robots === "blocked").map((b) => b.token);

  for (const token of blockedIn("search")) {
    const bot = botByToken(token);
    add({
      id: `robots-blocked:${token}`,
      severity: "problem",
      title: `${token} is blocked in robots.txt`,
      detail: `Your robots.txt tells ${token} (${bot.vendor}'s crawler for ${bot.product}) not to visit this site, so the site can't be included in those results. If that isn't what you want, remove or narrow the "Disallow" rule that applies to ${token}. It may come from a rule for all crawlers ("User-agent: *").`,
    });
  }
  if (robotsFile?.state === "error") {
    add({
      id: "robots-error",
      severity: "problem",
      title: `robots.txt returns a server error (HTTP ${robotsFile.httpStatus})`,
      detail: "Many crawlers treat a server error on robots.txt as \"don't crawl anything\" until it's fixed. Make sure /robots.txt answers normally, even if the file is empty.",
    });
  }
  if (noindexFor.length) {
    const who = noindexFor.includes("robots") ? "all crawlers" : names(noindexFor);
    add({
      id: "noindex",
      severity: "problem",
      title: "The home page asks to be kept out of search results",
      detail: `A "noindex" instruction (in a meta tag or the X-Robots-Tag header) is set for ${who}. That keeps the page out of search indexes, and AI search tools that rely on those indexes may leave it out too. Remove it unless that's intended.`,
    });
  }
  for (const b of bots.filter((x) => x.probe === "blocked")) {
    const bot = botByToken(b.token);
    const what = b.probeStatus ? `HTTP ${b.probeStatus}` : "a cut-off connection";
    if (bot.role === "search") {
      add({
        id: `probe-blocked:${b.token}`,
        severity: "problem",
        title: `Your server turns away requests that look like ${b.token}`,
        detail: `A request carrying the name ${b.token} got ${what}, while an ordinary request was answered normally. A firewall, CDN or security plugin may be blocking AI crawlers by name. Check its bot or user-agent rules. (Some firewalls check a crawler's network address instead of its name, which we can't test.)`,
      });
    } else {
      add({
        id: `probe-blocked:${b.token}`,
        severity: "info",
        title: `Your server turns away requests that look like ${b.token}`,
        detail: `A request carrying the name ${b.token} got ${what}. ${bot.vendor}'s ${bot.product} crawler is for training, so blocking it is a common choice and doesn't affect ${bot.vendor}'s search.`,
      });
    }
  }
  if (readable === "empty" && analysis) {
    add({
      id: "js-empty",
      severity: "problem",
      title: "The home page has almost no text without JavaScript",
      detail: `The HTML your server sends contains about ${analysis.words} words. Many AI crawlers read that HTML and don't run JavaScript, so they may see an empty page. Rendering the page on the server, or pre-rendering it, fixes this.`,
    });
  } else if (readable === "limited" && analysis) {
    add({
      id: "js-limited",
      severity: "notice",
      title: "Much of the home page may only appear with JavaScript",
      detail: `The HTML your server sends has about ${analysis.words} words and looks like an app that fills in the rest in the browser. Crawlers that don't run JavaScript will miss that part.`,
    });
  } else if (analysis && analysis.words < 30) {
    add({ id: "thin", severity: "notice", title: "The home page has very little text", detail: `There are about ${analysis.words} words on the page, so there's little for an AI tool to summarise or quote.` });
  }
  for (const token of blockedIn("assistant")) {
    const bot = botByToken(token);
    add({
      id: `robots-blocked:${token}`,
      severity: "notice",
      title: `${token} is blocked in robots.txt`,
      detail: `This is ${bot.product}. Blocking it can stop that assistant opening your pages when someone asks about them. (${bot.vendor} says some assistants fetching on a person's behalf may not follow robots.txt.)`,
    });
  }
  if (analysis) {
    if (!analysis.title) add({ id: "no-title", severity: "notice", title: "The home page has no title", detail: "A clear <title> is one of the first things search and AI tools use to understand a page." });
    if (!analysis.description) add({ id: "no-description", severity: "notice", title: "The home page has no meta description", detail: "A short description helps search and AI tools summarise the page accurately." });
    if (analysis.h1Count === 0 && readable === "readable") add({ id: "no-h1", severity: "notice", title: "The home page has no main heading", detail: "A single <h1> tells crawlers what the page is about." });
  }
  if (sitemap === false && listedSitemap) {
    add({
      id: "sitemap-broken",
      severity: "notice",
      title: "The sitemap listed in robots.txt doesn't work",
      detail: `robots.txt points to ${listedSitemap}, but that address ${sitemapStatus && sitemapStatus >= 400 ? `answered HTTP ${sitemapStatus}` : "didn't return a sitemap"}. Crawlers that follow it will find nothing.`,
    });
  } else if (sitemap === false) {
    add({ id: "no-sitemap", severity: "notice", title: "No sitemap found", detail: "A sitemap helps crawlers find every page. Add one at /sitemap.xml, or list it in robots.txt with a \"Sitemap:\" line." });
  }
  const trainingBlocked = blockedIn("training");
  if (trainingBlocked.length) {
    add({
      id: "training-blocked",
      severity: "info",
      title: `Blocked for AI training: ${names(trainingBlocked)}`,
      detail: "Blocking training crawlers is a common choice. It doesn't stop AI search tools from finding and quoting your pages.",
    });
  }
  if (!findings.some((f) => f.severity === "problem") && searchTokens.every((t) => bots.find((b) => b.token === t)?.robots !== "blocked")) {
    add({ id: "search-open", severity: "good", title: "AI search crawlers aren't blocked", detail: `${names(searchTokens)} are allowed by robots.txt, and your server answered requests that carry their names.` });
  }

  const order = { problem: 0, notice: 1, info: 2, good: 3 } as const;
  findings.sort((a, b) => order[a.severity] - order[b.severity]);
  const problems = findings.filter((f) => f.severity === "problem");
  const status: AiStatus = problems.length ? "problem" : findings.some((f) => f.severity === "notice") ? "attention" : "ok";

  return {
    v: 1,
    checkedAt,
    status,
    error: null,
    problemSig: problems.map((f) => f.id).sort().join("|"),
    page: analysis
      ? { httpStatus: home.status, title: analysis.title, description: analysis.description, words: analysis.words, h1Count: analysis.h1Count, jsonLd: analysis.jsonLd, readable, noindexFor }
      : { httpStatus: home.status, title: null, description: null, words: 0, h1Count: 0, jsonLd: 0, readable: "readable", noindexFor },
    robots: robotsFile,
    bots,
    extras: { sitemap, llmsTxt },
    findings,
  };
}

/** The longest the whole check may take. Adding a site waits for its checks, so a site that never answers can't hold that up for long. */
export const AI_CHECK_DEADLINE_MS = 25_000;

/** `runAiVisibility`, but it gives up with "couldn't tell" if it takes longer than `ms`. */
export async function runAiVisibilityWithin(host: string, ms: number = AI_CHECK_DEADLINE_MS, deps: Deps = {}): Promise<AiResult> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  const tooSlow = new Promise<AiResult>((resolve) => {
    timer = setTimeout(() => resolve(unknown((deps.now ?? Date.now)(), "The site was too slow to check: it didn't answer in time. We'll try again later.")), ms);
  });
  try {
    return await Promise.race([runAiVisibility(host, deps), tooSlow]);
  } finally {
    clearTimeout(timer);
  }
}
