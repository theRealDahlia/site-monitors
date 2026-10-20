import { randomBytes } from "node:crypto";
import net from "node:net";
import { CheckError, parseHostname } from "./hostname";
import { DAY, HOUR, MIN, everyText } from "./monitor-config";
import { FetchError, type Fetcher, safeFetch, validateTarget } from "./safe-fetch";
import { resolvePublicAddress } from "./ssl-check";
import { type UptimeResult, safeLookup } from "./uptime-check";

// The kinds of monitor. A "site" watches a whole website (uptime, SSL certificate, domain registration and, on Pro,
// AI visibility). The others each watch one thing, and only have an up/down state:
//  - http: one address, like https://example.com/checkout or an API endpoint, optionally with a keyword that must
//    (or must not) appear on the page, because a page can answer 200 and still show an error.
//  - tcp: a port on a server, like a mail or database server, that should accept connections.
//  - heartbeat: a scheduled job (a backup, a cron task) that pings us when it runs. We alert when a ping is late.

export const MONITOR_KINDS = ["site", "http", "tcp", "heartbeat"] as const;
export type MonitorKind = (typeof MONITOR_KINDS)[number];
export const isMonitorKind = (v: unknown): v is MonitorKind => typeof v === "string" && (MONITOR_KINDS as readonly string[]).includes(v);

export const KIND_LABEL: Record<MonitorKind, string> = { site: "Website", http: "Page", tcp: "Port", heartbeat: "Heartbeat" };

/** Checks that never run for this kind are scheduled this far ahead, so the scheduler never picks them up. */
export const NEVER = Number.MAX_SAFE_INTEGER;

export type KeywordMode = "contains" | "absent";

/** The settings a monitor of each kind carries, beyond its label. Saved in the monitors table's matching columns. */
export interface KindConfig {
  kind: MonitorKind;
  /** http: the full address. tcp: the hostname. */
  url: string | null;
  port: number | null;
  keyword: string | null;
  keyword_mode: KeywordMode | null;
  hb_every_ms: number | null;
  hb_grace_ms: number | null;
}

export const SITE_CONFIG: KindConfig = { kind: "site", url: null, port: null, keyword: null, keyword_mode: null, hb_every_ms: null, hb_grace_ms: null };

export const KEYWORD_MAX = 200;
/** How much of a page is searched for its keyword. */
export const KEYWORD_SEARCH_BYTES = 512 * 1024;

// How often a heartbeat may be expected, and how late it may be before we call it missed.
export const HEARTBEAT_EVERY = [5 * MIN, 15 * MIN, 30 * MIN, HOUR, 6 * HOUR, 12 * HOUR, DAY, 7 * DAY];
export const HEARTBEAT_GRACE = [MIN, 5 * MIN, 15 * MIN, 30 * MIN, HOUR, 6 * HOUR];

export const NAME_MAX = 80;

/** A heartbeat's secret ping address part. Long and random: anyone who has it can make the job look healthy. */
export const newHeartbeatToken = () => randomBytes(18).toString("base64url");
export const HEARTBEAT_TOKEN_PATTERN = /^[A-Za-z0-9_-]{24}$/;

// ---------- reading what someone typed ----------

export interface ParsedMonitor {
  /** The label: shown in the dashboard, emails and status pages, and unique per account. */
  host: string;
  config: KindConfig;
}

const clean = (v: unknown) => (typeof v === "string" ? v.replace(/[\p{Cc}\p{Cf}]/gu, "").replace(/\s+/g, " ").trim() : "");

/** A page address: https only to standard ports, a public hostname, no logins in it. */
export async function parseHttpMonitor(body: { url?: unknown; keyword?: unknown; keywordMode?: unknown }): Promise<ParsedMonitor> {
  let raw = clean(body.url);
  if (!raw) throw new CheckError("Enter the address of the page, like https://example.com/checkout.");
  if (!/^[a-z][a-z0-9+.-]*:\/\//i.test(raw)) raw = `https://${raw}`;
  let url: URL;
  try {
    url = validateTarget(raw);
  } catch (err) {
    throw new CheckError(err instanceof FetchError ? `${err.message}.` : "That doesn't look like a web address.");
  }
  const hostname = parseHostname(url.hostname);
  await resolvePublicAddress(hostname); // catches typos and private addresses before anything is saved
  url.hash = "";
  url.hostname = hostname;

  const keyword = clean(body.keyword) || null;
  if (keyword && keyword.length > KEYWORD_MAX) throw new CheckError(`Keep the keyword to ${KEYWORD_MAX} characters or fewer.`);
  const mode: KeywordMode = body.keywordMode === "absent" ? "absent" : "contains";

  const label = `${hostname}${url.pathname === "/" ? "" : url.pathname}${url.search}`.slice(0, 250);
  return {
    host: url.protocol === "http:" ? `http://${label}` : label,
    config: { ...SITE_CONFIG, kind: "http", url: url.href, keyword, keyword_mode: keyword ? mode : null },
  };
}

/** A server and port that should accept connections. */
export async function parseTcpMonitor(body: { host?: unknown; port?: unknown }): Promise<ParsedMonitor> {
  const hostname = parseHostname(clean(body.host), { ignorePort: true });
  const port = Number(body.port);
  if (!Number.isInteger(port) || port < 1 || port > 65535) throw new CheckError("Enter a port number between 1 and 65535.");
  await resolvePublicAddress(hostname);
  return { host: `${hostname}:${port}`, config: { ...SITE_CONFIG, kind: "tcp", url: hostname, port } };
}

/** A scheduled job that will ping us. Only a name and a timetable: there's nothing of theirs for us to reach. */
export function parseHeartbeatMonitor(body: { name?: unknown; everyMs?: unknown; graceMs?: unknown }): ParsedMonitor {
  const name = clean(body.name);
  if (!name) throw new CheckError("Give the job a name, like Nightly backup.");
  if (name.length > NAME_MAX) throw new CheckError(`Keep the name to ${NAME_MAX} characters or fewer.`);
  const every = Number(body.everyMs);
  const grace = Number(body.graceMs);
  if (!HEARTBEAT_EVERY.includes(every)) throw new CheckError("Choose how often the job runs.");
  if (!HEARTBEAT_GRACE.includes(grace)) throw new CheckError("Choose how late a check-in can be.");
  return { host: name, config: { ...SITE_CONFIG, kind: "heartbeat", hb_every_ms: every, hb_grace_ms: grace } };
}

// ---------- the checks ----------

/** Fetches one page. Up when it answers with a status below 400 (after redirects) and its keyword rule holds. */
export async function checkHttp(
  m: { url: string | null; keyword: string | null; keyword_mode: string | null },
  fetcher: Fetcher = safeFetch,
): Promise<UptimeResult> {
  if (!m.url) return { up: false, status: null, ms: null, error: "No address set" };
  try {
    const r = await fetcher(m.url, {
      userAgent: "SiteMonitors-UptimeCheck/1.0",
      maxBytes: m.keyword ? KEYWORD_SEARCH_BYTES : 1,
      accept: "*/*",
    });
    if (r.status >= 400) return { up: false, status: r.status, ms: r.ms, error: `HTTP ${r.status}` };
    if (m.keyword) {
      const found = r.body.toLowerCase().includes(m.keyword.toLowerCase());
      if (m.keyword_mode === "absent" && found) return { up: false, status: r.status, ms: r.ms, error: `The page contains "${m.keyword}"` };
      if (m.keyword_mode !== "absent" && !found) {
        const note = r.truncated ? ` in its first ${KEYWORD_SEARCH_BYTES / 1024} KB` : "";
        return { up: false, status: r.status, ms: r.ms, error: `"${m.keyword}" wasn't found on the page${note}` };
      }
    }
    return { up: true, status: r.status, ms: r.ms, error: null };
  } catch (err) {
    return { up: false, status: null, ms: null, error: err instanceof FetchError ? err.message : "The check couldn't be completed" };
  }
}

const TCP_TIMEOUT_MS = 10_000;

/** Opens a connection to a port and closes it straight away. Up when the connection is accepted. */
export function checkTcp(m: { url: string | null; port: number | null }): Promise<UptimeResult> {
  const host = m.url;
  const port = m.port;
  if (!host || !port) return Promise.resolve({ up: false, status: null, ms: null, error: "No server set" });
  if (net.isIP(host)) return Promise.resolve({ up: false, status: null, ms: null, error: "IP addresses can't be monitored" });
  return new Promise((resolve) => {
    const started = Date.now();
    let settled = false;
    const done = (r: UptimeResult) => {
      if (settled) return;
      settled = true;
      socket.destroy();
      resolve(r);
    };
    // safeLookup refuses private and internal addresses, so this can't be used to reach anything inside our network.
    const socket = net.connect({ host, port, lookup: safeLookup, timeout: TCP_TIMEOUT_MS });
    socket.once("connect", () => done({ up: true, status: null, ms: Date.now() - started, error: null }));
    socket.once("timeout", () => done({ up: false, status: null, ms: null, error: `No answer on port ${port} within 10s` }));
    socket.once("error", (err: NodeJS.ErrnoException) => {
      const text: Record<string, string> = {
        ECONNREFUSED: `Port ${port} refused the connection`,
        ENOTFOUND: "DNS lookup failed",
        EAI_AGAIN: "DNS lookup failed",
        EHOSTUNREACH: "Host unreachable",
        ENETUNREACH: "Network unreachable",
        ECONNRESET: "Connection reset",
        EPRIVATE: "Resolves to a private address",
      };
      done({ up: false, status: null, ms: null, error: text[err.code ?? ""] ?? err.message.slice(0, 120) });
    });
  });
}

/** When a heartbeat is next due to have checked in by: its last ping (or its creation) plus the interval and grace. */
export function heartbeatDeadline(m: { hb_last_ping: number | null; created_at: number; hb_every_ms: number | null; hb_grace_ms: number | null }): number {
  return (m.hb_last_ping ?? m.created_at) + (m.hb_every_ms ?? DAY) + (m.hb_grace_ms ?? 0);
}

/** Is a heartbeat on time? It's "up" while the latest ping is within its interval and grace. No network involved. */
export function checkHeartbeat(
  m: { hb_last_ping: number | null; created_at: number; hb_every_ms: number | null; hb_grace_ms: number | null },
  now: number,
): UptimeResult {
  if (now <= heartbeatDeadline(m)) return { up: true, status: null, ms: null, error: null };
  const every = everyText(m.hb_every_ms ?? DAY);
  const error = m.hb_last_ping ? `No check-in for ${since(now - m.hb_last_ping)} (expected every ${every})` : `No check-in yet (expected every ${every})`;
  return { up: false, status: null, ms: null, error };
}

function since(ms: number): string {
  const mins = Math.round(ms / MIN);
  if (mins < 60) return `${mins} minute${mins === 1 ? "" : "s"}`;
  const hours = Math.round(ms / HOUR);
  if (hours < 48) return `${hours} hour${hours === 1 ? "" : "s"}`;
  const days = Math.round(ms / DAY);
  return `${days} days`;
}

/** Reads a request to add or change a monitor of a given kind. Throws CheckError with a message for the person. */
export async function parseMonitorRequest(kind: MonitorKind, body: Record<string, unknown>): Promise<ParsedMonitor> {
  switch (kind) {
    case "http":
      return parseHttpMonitor(body);
    case "tcp":
      return parseTcpMonitor(body);
    case "heartbeat":
      return parseHeartbeatMonitor(body);
    default: {
      const host = parseHostname(typeof body.host === "string" ? body.host : "", { ignorePort: true });
      await resolvePublicAddress(host); // catches typos and private addresses before we save anything
      return { host, config: SITE_CONFIG };
    }
  }
}

/** True when a parsed request would leave a monitor exactly as it is. */
export function sameTarget(
  m: { host: string; url: string | null; port: number | null; keyword: string | null; keyword_mode: string | null; hb_every_ms: number | null; hb_grace_ms: number | null },
  p: ParsedMonitor,
): boolean {
  const c = p.config;
  return m.host === p.host && m.url === c.url && m.port === c.port && m.keyword === c.keyword && m.keyword_mode === c.keyword_mode && m.hb_every_ms === c.hb_every_ms && m.hb_grace_ms === c.hb_grace_ms;
}
