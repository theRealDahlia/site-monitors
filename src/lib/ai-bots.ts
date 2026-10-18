// The AI crawlers the AI-visibility check looks at, and the shape of its results. Nothing here touches the
// network or the server, so the dashboard can use it too.
//
// The names and what each one does come from the companies' own documentation (OpenAI, Anthropic, Perplexity,
// Google, Apple, Common Crawl), as checked in October 2026. They change, so this list is the one place to update.

/**
 * What a crawler is for. They're controlled separately, which is the whole point:
 *  - search: builds the index behind AI search answers. Blocking it keeps a site out of those answers.
 *  - assistant: fetches a page because a person asked an AI about it. Some companies say these ignore robots.txt.
 *  - training: collects text to train models. Blocking it is a common, deliberate choice and doesn't affect search.
 */
export type BotRole = "search" | "assistant" | "training";

export interface AiBot {
  /** The name used in robots.txt. */
  token: string;
  vendor: string;
  role: BotRole;
  /** What it's for, in a few words. */
  product: string;
}

export const AI_BOTS: AiBot[] = [
  { token: "OAI-SearchBot", vendor: "OpenAI", role: "search", product: "ChatGPT search" },
  { token: "Claude-SearchBot", vendor: "Anthropic", role: "search", product: "Claude's search" },
  { token: "PerplexityBot", vendor: "Perplexity", role: "search", product: "Perplexity search" },
  { token: "Googlebot", vendor: "Google", role: "search", product: "Google Search, which also feeds Google's AI features" },
  { token: "ChatGPT-User", vendor: "OpenAI", role: "assistant", product: "ChatGPT opening a page a person asked about" },
  { token: "Claude-User", vendor: "Anthropic", role: "assistant", product: "Claude opening a page a person asked about" },
  { token: "Perplexity-User", vendor: "Perplexity", role: "assistant", product: "Perplexity opening a page a person asked about" },
  { token: "GPTBot", vendor: "OpenAI", role: "training", product: "OpenAI model training" },
  { token: "ClaudeBot", vendor: "Anthropic", role: "training", product: "Anthropic model training" },
  { token: "Google-Extended", vendor: "Google", role: "training", product: "Gemini training and grounding" },
  { token: "Applebot-Extended", vendor: "Apple", role: "training", product: "Apple model training" },
  { token: "CCBot", vendor: "Common Crawl", role: "training", product: "Common Crawl's open dataset, used to train many models" },
];

export const ROLE_LABEL: Record<BotRole, string> = { search: "AI search", assistant: "AI assistants", training: "AI training" };

export type Severity = "problem" | "notice" | "info" | "good";
export type AiStatus = "ok" | "attention" | "problem" | "unknown";
/** What robots.txt says for a crawler: all of it, only some sample paths, none of it, or we couldn't tell. */
export type RobotsState = "allowed" | "partial" | "blocked" | "unknown";
/** How the server answered a request that identifies as a crawler, compared with a normal request. */
export type ProbeState = "ok" | "blocked" | "limited" | "error";

export interface Finding {
  /** Stable, so the same problem gives the same id every time. */
  id: string;
  severity: Severity;
  title: string;
  detail: string;
}

export interface BotResult {
  token: string;
  robots: RobotsState;
  probe?: ProbeState;
  probeStatus?: number | null;
}

export interface AiResult {
  v: 1;
  checkedAt: number;
  status: AiStatus;
  /** Why we couldn't tell, when status is "unknown". */
  error: string | null;
  /** The ids of the current problems, sorted and joined. Empty when there are none. Used to decide when to alert. */
  problemSig: string;
  page: {
    httpStatus: number;
    title: string | null;
    description: string | null;
    words: number;
    h1Count: number;
    jsonLd: number;
    /** What a crawler that doesn't run JavaScript would see. */
    readable: "readable" | "limited" | "empty";
    noindexFor: string[];
  } | null;
  robots: { state: "found" | "missing" | "error" | "unreachable"; httpStatus: number | null; sitemaps: number } | null;
  bots: BotResult[];
  extras: { sitemap: boolean | null; llmsTxt: boolean | null };
  findings: Finding[];
}
