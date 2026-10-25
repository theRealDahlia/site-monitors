import { randomBytes } from "node:crypto";
import dns from "node:dns";
import { decodeEntities } from "./page-analysis";
import { FetchError, type Fetcher, safeFetch } from "./safe-fetch";

// A daily health scan of a whole site (Starter and up), beyond whether it's up:
//  - DNS: its main records, so we can tell the owner when they change (a hijacked or mistyped record takes a site, or
//    its email, down without any check failing at first).
//  - Email setup: SPF, DMARC and DKIM, which decide whether mail from the domain lands or is spoofed.
//  - Security headers: what the homepage tells browsers about protecting visitors.
//  - Broken links (Pro, weekly): links on the homepage that lead nowhere.
// Pure findings: deciding what to email is in alerts.ts, and storing them in monitor-runner.ts.

export interface Resolver {
  resolve4(name: string): Promise<string[]>;
  resolve6(name: string): Promise<string[]>;
  resolveCname(name: string): Promise<string[]>;
  resolveMx(name: string): Promise<{ exchange: string; priority: number }[]>;
  resolveNs(name: string): Promise<string[]>;
  resolveTxt(name: string): Promise<string[][]>;
}

const system = new dns.promises.Resolver({ timeout: 4000, tries: 2 });
export const systemResolver: Resolver = {
  resolve4: (n) => system.resolve4(n),
  resolve6: (n) => system.resolve6(n),
  resolveCname: (n) => system.resolveCname(n),
  resolveMx: (n) => system.resolveMx(n),
  resolveNs: (n) => system.resolveNs(n),
  resolveTxt: (n) => system.resolveTxt(n),
};

const NO_RECORD = new Set(["ENODATA", "ENOTFOUND", "NXDOMAIN"]);
type Lookup<T> = { ok: true; value: T } | { ok: false };
/** A lookup that treats "no such record" as an empty answer, and anything else (a timeout) as not knowing. */
async function look<T>(p: Promise<T[]>): Promise<Lookup<T[]>> {
  try {
    return { ok: true, value: await p };
  } catch (err) {
    return NO_RECORD.has((err as { code?: string }).code ?? "") ? { ok: true, value: [] } : { ok: false };
  }
}

export type Tone = "good" | "notice" | "problem" | "info";
export interface Finding {
  id: string;
  tone: Tone;
  title: string;
  detail: string;
}

// ---------- DNS ----------

/**
 * The domain a host belongs to, for email and name-server checks: the nearest name, going up from the host, that has
 * name servers of its own (www.shop.example.co.uk belongs to example.co.uk). Falls back to the last two labels.
 */
export async function zoneOf(host: string, r: Resolver = systemResolver): Promise<string> {
  const labels = host.split(".");
  for (let i = 0; i < labels.length - 1 && i < 4; i++) {
    const name = labels.slice(i).join(".");
    // A name that's an alias (www.github.com -> github.com) isn't a zone, even though asking it for name servers
    // follows the alias and answers with its target's.
    const cname = await look(r.resolveCname(name));
    if (cname.ok && cname.value.length) continue;
    const ns = await look(r.resolveNs(name));
    if (ns.ok && ns.value.length) return name;
  }
  return labels.slice(-2).join(".");
}

export interface DnsSnapshot {
  a: string[];
  aaaa: string[];
  cname: string[];
  mx: string[];
  ns: string[];
}

const sorted = (xs: string[]) => [...new Set(xs.map((x) => x.toLowerCase().replace(/\.$/, "")))].sort();

/** The site's main DNS records. Null if any lookup couldn't be answered, so a flaky resolver never looks like a change. */
export async function dnsSnapshot(host: string, domain: string, r: Resolver = systemResolver): Promise<DnsSnapshot | null> {
  const [a, aaaa, cname, mx, ns] = await Promise.all([look(r.resolve4(host)), look(r.resolve6(host)), look(r.resolveCname(host)), look(r.resolveMx(domain)), look(r.resolveNs(domain))]);
  if (!a.ok || !aaaa.ok || !cname.ok || !mx.ok || !ns.ok) return null;
  return {
    a: sorted(a.value),
    aaaa: sorted(aaaa.value),
    cname: sorted(cname.value),
    // A "null MX" (no server) says the domain takes no email.
    mx: sorted(mx.value.map((m) => (m.exchange && m.exchange !== "." ? `${m.priority} ${m.exchange}` : "none (this domain takes no email)"))),
    ns: sorted(ns.value),
  };
}

const LABELS: Record<keyof DnsSnapshot, string> = { a: "A (IPv4 address)", aaaa: "AAAA (IPv6 address)", cname: "CNAME", mx: "MX (mail servers)", ns: "NS (name servers)" };

/** What changed between two snapshots, one line per record type. */
export function dnsChanges(before: DnsSnapshot, after: DnsSnapshot): string[] {
  const out: string[] = [];
  for (const k of Object.keys(LABELS) as (keyof DnsSnapshot)[]) {
    const was = before[k].join(", ") || "none";
    const now = after[k].join(", ") || "none";
    if (was !== now) out.push(`${LABELS[k]}: ${was} → ${now}`);
  }
  return out;
}

// ---------- email ----------

/** Selectors that common mail services use for DKIM. DKIM records can't be listed, only looked up by name. */
export const DKIM_SELECTORS = ["default", "google", "selector1", "selector2", "k1", "k2", "s1", "s2", "mail", "dkim", "smtp", "mandrill", "mxvault", "zoho", "fm1", "protonmail"];

export interface EmailResult {
  receivesMail: boolean;
  spf: string | null;
  dmarc: string | null;
  dkimSelectors: string[];
  findings: Finding[];
}

export async function checkEmail(domain: string, r: Resolver = systemResolver): Promise<EmailResult | null> {
  const [mx, txt, dmarcTxt] = await Promise.all([look(r.resolveMx(domain)), look(r.resolveTxt(domain)), look(r.resolveTxt(`_dmarc.${domain}`))]);
  if (!mx.ok || !txt.ok || !dmarcTxt.ok) return null;
  const join = (rows: string[][]) => rows.map((parts) => parts.join(""));
  const spfs = join(txt.value).filter((t) => /^v=spf1(\s|$)/i.test(t));
  const dmarcs = join(dmarcTxt.value).filter((t) => /^v=DMARC1/i.test(t));
  // A DKIM key that's really there: a "p=" with an actual key in it. An empty "p=" means the key was withdrawn.
  const hasKey = async (sel: string) => {
    const res = await look(r.resolveTxt(`${sel}._domainkey.${domain}`));
    return res.ok && join(res.value).some((t) => /(^|;)\s*p\s*=\s*[A-Za-z0-9+/]{16,}/i.test(t));
  };
  // Some domains answer for every name under _domainkey (a wildcard). Then a made-up selector "has" a key too, and
  // finding one under a common name means nothing.
  const wildcard = await hasKey(`sm-probe-${randomBytes(6).toString("hex")}`);
  const dkim = wildcard ? [] : (await Promise.all(DKIM_SELECTORS.map(async (sel) => ((await hasKey(sel)) ? sel : null)))).filter((s): s is string => s !== null);

  // A "null MX" (priority 0, no server: RFC 7505) is a domain saying it takes no email.
  const receivesMail = mx.value.some((m) => m.exchange && m.exchange !== ".");
  const findings: Finding[] = [];
  const spf = spfs[0] ?? null;
  if (spfs.length > 1) findings.push({ id: "spf-multiple", tone: "problem", title: "More than one SPF record", detail: "A domain must have exactly one SPF record; with two, receiving servers treat SPF as broken. Merge them into one." });
  else if (!spf) findings.push({ id: "spf-missing", tone: receivesMail ? "problem" : "notice", title: "No SPF record", detail: "SPF lists the servers allowed to send email for the domain. Without it, anyone can send mail that claims to be from it." });
  else if (/\+all\b/i.test(spf)) findings.push({ id: "spf-open", tone: "problem", title: "SPF allows anyone to send", detail: 'The record ends in "+all", which lets every server on the internet send as this domain. Use "-all" or "~all".' });
  else if (/\?all\b/i.test(spf) || !/[~-]all\b/i.test(spf)) findings.push({ id: "spf-weak", tone: "notice", title: "SPF doesn't say what to do with other senders", detail: 'End the record with "-all" (reject) or "~all" (mark as suspicious).' });
  else findings.push({ id: "spf-ok", tone: "good", title: "SPF is set up", detail: spf });

  const dmarc = dmarcs[0] ?? null;
  const policy = dmarc ? /;\s*p\s*=\s*(\w+)/i.exec(`;${dmarc}`)?.[1]?.toLowerCase() : null;
  if (!dmarc) findings.push({ id: "dmarc-missing", tone: "problem", title: "No DMARC record", detail: `DMARC tells receiving servers what to do with mail that fails SPF and DKIM. Add a TXT record at _dmarc.${domain}, starting with "v=DMARC1; p=none" to begin with.` });
  else if (policy === "none") findings.push({ id: "dmarc-none", tone: "notice", title: "DMARC is only monitoring", detail: 'With "p=none", mail that fails checks is still delivered. Move to "p=quarantine" or "p=reject" once reports look right.' });
  else findings.push({ id: "dmarc-ok", tone: "good", title: `DMARC is enforced (p=${policy ?? "?"})`, detail: dmarc });

  if (wildcard) findings.push({ id: "dkim-wildcard", tone: "info", title: "DKIM couldn't be checked", detail: "The domain answers for every DKIM name, so we can't tell which keys are real. Your mail service's settings will say." });
  else if (dkim.length) findings.push({ id: "dkim-ok", tone: "good", title: "DKIM found", detail: `Selector${dkim.length === 1 ? "" : "s"}: ${dkim.join(", ")}.` });
  else if (receivesMail) findings.push({ id: "dkim-unknown", tone: "info", title: "No DKIM found under common names", detail: "DKIM can only be looked up by its selector name. We tried the usual ones; your mail service may use another. Its settings will say." });

  if (!receivesMail) findings.push({ id: "no-mx", tone: "info", title: "This domain doesn't receive email", detail: 'It has no MX records. If it never sends email either, an SPF record of "v=spf1 -all" and DMARC "p=reject" stop others sending as it.' });
  return { receivesMail, spf, dmarc, dkimSelectors: dkim, findings };
}

// ---------- security headers ----------

export interface HeadersResult {
  grade: "A" | "B" | "C" | "D" | "F";
  present: Record<string, string | null>;
  findings: Finding[];
}

const HEADER_CHECKS = [
  { name: "strict-transport-security", id: "hsts", title: "HSTS", why: "Tells browsers to only ever use HTTPS for this site, so a visitor can't be quietly downgraded to an insecure connection." },
  { name: "content-security-policy", id: "csp", title: "Content Security Policy", why: "Limits where scripts and other content can load from, which blunts cross-site scripting attacks." },
  { name: "x-content-type-options", id: "xcto", title: "X-Content-Type-Options", why: 'Set to "nosniff", it stops browsers guessing a file\'s type and running something as a script that shouldn\'t be.' },
  { name: "x-frame-options", id: "xfo", title: "Clickjacking protection", why: 'X-Frame-Options or CSP "frame-ancestors" stops other sites showing yours in a hidden frame to trick clicks.' },
  { name: "referrer-policy", id: "referrer", title: "Referrer-Policy", why: "Controls how much of your page addresses other sites see when visitors follow links." },
] as const;

export function gradeHeaders(headers: Record<string, string | string[] | undefined>): HeadersResult {
  const get = (n: string) => {
    const v = headers[n];
    return v === undefined ? null : Array.isArray(v) ? v.join(", ") : v;
  };
  const present: Record<string, string | null> = {};
  const findings: Finding[] = [];
  let score = 0;
  for (const h of HEADER_CHECKS) {
    let value = get(h.name);
    let ok = value !== null;
    if (h.id === "hsts" && value) {
      const age = Number(/max-age\s*=\s*"?(\d+)/i.exec(value)?.[1] ?? 0);
      ok = age >= 15_552_000; // about 6 months
      if (!ok) findings.push({ id: "hsts-short", tone: "notice", title: "HSTS is set for a short time", detail: `max-age is ${age} seconds. Use at least 15552000 (6 months); 31536000 (a year) is usual.` });
    }
    if (h.id === "xcto" && value) ok = /nosniff/i.test(value);
    if (h.id === "xfo" && !value) {
      const ancestors = /frame-ancestors[^;]*/i.exec(get("content-security-policy") ?? "")?.[0] ?? null;
      if (ancestors) {
        value = ancestors;
        ok = true;
      }
    }
    present[h.id] = value;
    if (ok) score++;
    else if (!(h.id === "hsts" && value)) findings.push({ id: `${h.id}-missing`, tone: h.id === "hsts" || h.id === "xfo" ? "problem" : "notice", title: `No ${h.title}`, detail: h.why });
  }
  // Only all five headers earn an A. Missing one that's marked "Fix" (HSTS, clickjacking protection) holds the grade at C, so the grade never looks fine next to a red finding.
  let grade = (["F", "D", "D", "C", "B", "A"] as const)[score];
  if (findings.some((f) => f.tone === "problem") && (grade === "A" || grade === "B")) grade = "C";
  if (findings.length === 0) findings.push({ id: "headers-ok", tone: "good", title: "All the usual security headers are set", detail: "HSTS, a content security policy, nosniff, clickjacking protection and a referrer policy." });
  return { grade, present, findings };
}

// ---------- broken links ----------

export const MAX_LINKS = 50;
const LINK_BUDGET_MS = 45_000;

export interface LinkResult {
  checked: number;
  broken: { url: string; status: number | null; error: string | null }[];
}

/** The http(s) links on a page, made absolute, without duplicates or in-page anchors. */
export function extractLinks(html: string, base: string): string[] {
  const out = new Set<string>();
  for (const m of html.matchAll(/<a\b[^>]*?\bhref\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s>]+))/gi)) {
    const raw = decodeEntities((m[1] ?? m[2] ?? m[3] ?? "").trim());
    if (!raw || raw.startsWith("#") || /^(mailto|tel|javascript|data):/i.test(raw)) continue;
    try {
      const u = new URL(raw, base);
      if (u.protocol !== "http:" && u.protocol !== "https:") continue;
      u.hash = "";
      out.add(u.href);
    } catch {
      // not a usable address
    }
    if (out.size >= MAX_LINKS) break;
  }
  return [...out];
}

/** Follows each link (a few at a time, within a time budget) and lists the ones that fail. */
export async function checkLinks(links: string[], fetcher: Fetcher = safeFetch): Promise<LinkResult> {
  const started = Date.now();
  const broken: LinkResult["broken"] = [];
  let checked = 0;
  let next = 0;
  const worker = async () => {
    while (next < links.length && Date.now() - started < LINK_BUDGET_MS) {
      const url = links[next++];
      checked++;
      try {
        const r = await fetcher(url, { userAgent: "SiteMonitors-LinkCheck/1.0", maxBytes: 1, accept: "*/*" });
        // 401/403/429 usually mean the link is fine but turns robots away; only report what's clearly gone or failing.
        if (r.status === 404 || r.status === 410 || r.status >= 500) broken.push({ url, status: r.status, error: null });
      } catch (err) {
        const code = err instanceof FetchError ? err.code : "";
        // Addresses we won't fetch (odd ports, IPs) aren't the site's fault.
        if (code !== "EBADURL") broken.push({ url, status: null, error: err instanceof Error ? err.message : "No answer" });
      }
    }
  };
  await Promise.all(Array.from({ length: 5 }, worker));
  return { checked, broken };
}

// ---------- the whole scan ----------

export interface ScanResult {
  v: 1;
  at: number;
  dns: DnsSnapshot | null;
  email: EmailResult | null;
  headers: HeadersResult | null;
  /** Null when not included (plan) or not due this time; see linksAt. */
  links: LinkResult | null;
  linksAt: number | null;
  homepageError: string | null;
}

/** Runs the scan. `withLinks` adds the broken-link check. Never throws: what couldn't be checked is null. */
export async function runScan(
  host: string,
  knownDomain: string | null,
  opts: { withLinks: boolean; resolver?: Resolver; fetcher?: Fetcher; now?: number },
): Promise<ScanResult> {
  const r = opts.resolver ?? systemResolver;
  const domain = knownDomain ?? (await zoneOf(host, r));
  const fetcher = opts.fetcher ?? safeFetch;
  const now = opts.now ?? Date.now();
  const [snap, email, home] = await Promise.all([
    dnsSnapshot(host, domain, r).catch(() => null),
    checkEmail(domain, r).catch(() => null),
    fetcher(`https://${host}/`, { userAgent: "SiteMonitors-HealthScan/1.0", maxBytes: opts.withLinks ? 512 * 1024 : 1 }).then(
      (x) => ({ ok: true as const, x }),
      (err: unknown) => ({ ok: false as const, error: err instanceof Error ? err.message : "No answer" }),
    ),
  ]);
  let links: LinkResult | null = null;
  if (opts.withLinks && home.ok) links = await checkLinks(extractLinks(home.x.body, home.x.finalUrl), fetcher);
  return {
    v: 1,
    at: now,
    dns: snap,
    email,
    headers: home.ok ? gradeHeaders(home.x.headers) : null,
    links,
    linksAt: links ? now : null,
    homepageError: home.ok ? null : home.error,
  };
}
