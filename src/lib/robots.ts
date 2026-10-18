// A reader for robots.txt that follows RFC 9309, the standard crawlers are meant to follow. Pure text in,
// answers out: no network or database, so every rule can be tested directly.
//
// The parts people get wrong, and that a false "you're blocked" would come from:
//  - A crawler obeys only the group that names it. The "*" group is a fallback used only when no group names it.
//  - Several "User-agent" lines in a row share one rule list, and a name that appears in two groups merges them.
//  - When several rules match a path, the longest one wins, and "Allow" wins a tie.
//  - "*" matches any run of characters, and a trailing "$" means "ends here".

export interface RobotsRule {
  allow: boolean;
  pattern: string;
}
export interface RobotsGroup {
  /** Lower-case crawler names this group is for. "*" means everyone else. */
  agents: string[];
  rules: RobotsRule[];
}
export interface ParsedRobots {
  groups: RobotsGroup[];
  sitemaps: string[];
}

export function parseRobots(text: string): ParsedRobots {
  const groups: RobotsGroup[] = [];
  const sitemaps: string[] = [];
  let current: RobotsGroup | null = null;
  // True while we're still reading the "User-agent" lines at the top of a group.
  let readingAgents = false;

  for (const raw of text.replace(/^﻿/, "").split(/\r\n|\r|\n/)) {
    const line = raw.replace(/#.*/, "").trim();
    if (!line) continue; // blank lines and comments never end a group
    const m = /^([A-Za-z-]+)\s*:\s*(.*)$/.exec(line);
    if (!m) continue;
    const key = m[1].toLowerCase();
    const value = m[2].trim();

    if (key === "user-agent") {
      if (!current || !readingAgents) {
        current = { agents: [], rules: [] };
        groups.push(current);
      }
      // "GPTBot/1.1" is written by some sites for "GPTBot".
      current.agents.push(value.toLowerCase().split("/")[0].trim());
      readingAgents = true;
    } else if (key === "allow" || key === "disallow") {
      readingAgents = false;
      // Rules before any User-agent line belong to nobody. An empty Disallow means "nothing is off limits".
      if (current && value !== "") current.rules.push({ allow: key === "allow", pattern: value });
    } else if (key === "sitemap") {
      if (/^https?:\/\//i.test(value)) sitemaps.push(value);
    } else {
      readingAgents = false; // Crawl-delay and other lines sit inside a group without ending it
    }
  }
  return { groups, sitemaps };
}

/** Which rules apply to a crawler: its own group(s) if any name it, otherwise the "*" group(s), otherwise none. */
export function rulesFor(robots: ParsedRobots, crawler: string): { rules: RobotsRule[]; via: "named" | "wildcard" | "none" } {
  const name = crawler.toLowerCase();
  const named = robots.groups.filter((g) => g.agents.includes(name));
  if (named.length) return { rules: named.flatMap((g) => g.rules), via: "named" };
  const wildcard = robots.groups.filter((g) => g.agents.includes("*"));
  if (wildcard.length) return { rules: wildcard.flatMap((g) => g.rules), via: "wildcard" };
  return { rules: [], via: "none" };
}

/** Upper-cases %xx escapes, so "%e2%80" and "%E2%80" are the same path. */
const normalizePath = (p: string) => p.replace(/%[0-9a-f]{2}/gi, (e) => e.toUpperCase());

function matches(pattern: string, path: string): boolean {
  const anchored = pattern.endsWith("$");
  const body = normalizePath(anchored ? pattern.slice(0, -1) : pattern);
  const regex = body
    .split("*")
    .map((part) => part.replace(/[.+?^${}()|[\]\\]/g, "\\$&"))
    .join(".*");
  return new RegExp(`^${regex}${anchored ? "$" : ""}`).test(normalizePath(path));
}

/** May `crawler` fetch `path`? The longest matching rule wins, and Allow wins a tie. No matching rule means yes. */
export function isAllowed(robots: ParsedRobots, crawler: string, path: string): boolean {
  let best: RobotsRule | null = null;
  for (const rule of rulesFor(robots, crawler).rules) {
    if (!matches(rule.pattern, path)) continue;
    if (!best || rule.pattern.length > best.pattern.length || (rule.pattern.length === best.pattern.length && rule.allow && !best.allow)) {
      best = rule;
    }
  }
  return best ? best.allow : true;
}
