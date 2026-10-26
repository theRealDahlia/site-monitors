import dns from "node:dns";
import { randomBytes } from "node:crypto";
import { db } from "./db";
import { CheckError, parseHostname } from "./hostname";
import { ourHost } from "./hosts";

export { isPrimaryHost, ourHost } from "./hosts";

// A status page on the customer's own domain, like status.theircompany.com (a Pro feature).
//
// Ownership: a domain only counts once its owner has put a record we gave them in its DNS. Until then it's a claim
// that serves nothing, and two accounts can claim the same name; whoever proves it first wins. Without this, anyone
// could point our server's certificate and pages at a domain that isn't theirs.
//
// Routing: the domain must also point at us (a CNAME to our own address) for visitors to arrive. We check that and
// tell the owner, but it isn't part of ownership.
//
// Staying owned: verified domains are re-checked daily. If the record has been gone for several days in a row the
// domain is released, so a domain that lapses and is bought by someone else can't keep serving the old owner's page.

export const VERIFY_LABEL = "_sitemonitors-verify";
export const VERIFY_PREFIX = "sm-verify=";
/** Daily re-checks in a row that must miss the record before a verified domain is released. */
export const RELEASE_AFTER_MISSES = 3;
const DAY = 86_400_000;

export interface CustomDomainRow {
  id: number;
  user_id: number;
  monitor_id: number | null;
  client_id: number | null;
  domain: string;
  token: string;
  verified_at: number | null;
  last_check_at: number | null;
  fail_count: number;
  created_at: number;
}

export const txtName = (domain: string) => `${VERIFY_LABEL}.${domain}`;
export const txtValue = (token: string) => `${VERIFY_PREFIX}${token}`;

// ---------- what may be claimed ----------

export function validateDomain(input: unknown): { ok: true; domain: string } | { ok: false; error: string } {
  if (typeof input !== "string") return { ok: false, error: "Enter a domain, like status.yourcompany.com." };
  let domain: string;
  try {
    domain = parseHostname(input, { ignorePort: true });
  } catch (err) {
    return { ok: false, error: err instanceof CheckError ? err.message : "That doesn't look like a valid domain name." };
  }
  // Our real domain is refused whatever the app's address setting says, so a mistake there can't open it up.
  for (const own of new Set([ourHost(), "site-monitors.net"])) {
    if (domain === own || domain.endsWith(`.${own}`)) return { ok: false, error: "That's one of our own addresses. Use a domain that belongs to you." };
  }
  if (domain === "localhost" || /\.(localhost|local|internal|invalid|test|example)$/.test(domain)) return { ok: false, error: "Use a real domain that you own." };
  if (domain.startsWith("_") || domain.split(".").length < 2) return { ok: false, error: "That doesn't look like a valid domain name." };
  return { ok: true, domain };
}

// ---------- the DNS checks ----------

export interface DnsResolver {
  resolveTxt(name: string): Promise<string[][]>;
  resolveCname(name: string): Promise<string[]>;
  resolve4(name: string): Promise<string[]>;
}

const system = new dns.promises.Resolver({ timeout: 4000, tries: 2 });
export const systemResolver: DnsResolver = {
  resolveTxt: (n) => system.resolveTxt(n),
  resolveCname: (n) => system.resolveCname(n),
  resolve4: (n) => system.resolve4(n),
};

export interface DnsCheck {
  /** Is our proof record there? "wrong" means a Site Monitors record exists but not for this claim. */
  txt: "found" | "missing" | "wrong" | "error";
  /** Does the domain lead to us? */
  routing: "ok" | "missing" | "wrong" | "error";
  /** What the domain leads to now, when it isn't us. */
  pointsTo: string | null;
}

const NO_RECORD = new Set(["ENODATA", "ENOTFOUND", "NXDOMAIN"]);
const codeOf = (err: unknown) => (err as { code?: string }).code ?? "";
const bare = (name: string) => name.toLowerCase().replace(/\.$/, "");

/** Looks for the proof record only. Used by the daily re-check. */
export async function checkTxt(domain: string, token: string, resolver: DnsResolver = systemResolver): Promise<DnsCheck["txt"]> {
  try {
    // A long value can be split into pieces; they read as one.
    const records = (await resolver.resolveTxt(txtName(domain))).map((parts) => parts.join(""));
    const ours = records.filter((r) => r.startsWith(VERIFY_PREFIX));
    if (ours.includes(txtValue(token))) return "found";
    return ours.length ? "wrong" : "missing";
  } catch (err) {
    return NO_RECORD.has(codeOf(err)) ? "missing" : "error";
  }
}

async function checkRouting(domain: string, resolver: DnsResolver): Promise<{ routing: DnsCheck["routing"]; pointsTo: string | null }> {
  const ours = ourHost();
  let cname: string | null = null;
  try {
    const targets = (await resolver.resolveCname(domain)).map(bare);
    cname = targets[0] ?? null;
    if (targets.some((t) => t === ours || t.endsWith(`.${ours}`))) return { routing: "ok", pointsTo: cname };
  } catch (err) {
    if (!NO_RECORD.has(codeOf(err))) return { routing: "error", pointsTo: null };
  }
  try {
    const addresses = await resolver.resolve4(domain);
    const ourAddresses = await resolver.resolve4(ours);
    if (addresses.some((a) => ourAddresses.includes(a))) return { routing: "ok", pointsTo: cname };
    return { routing: "wrong", pointsTo: cname ?? addresses[0] ?? null };
  } catch (err) {
    return NO_RECORD.has(codeOf(err)) ? { routing: cname ? "wrong" : "missing", pointsTo: cname } : { routing: "error", pointsTo: cname };
  }
}

export async function checkDns(domain: string, token: string, resolver: DnsResolver = systemResolver): Promise<DnsCheck> {
  const [txt, route] = await Promise.all([checkTxt(domain, token, resolver), checkRouting(domain, resolver)]);
  return { txt, ...route };
}

/** What the settings screen shows for a claim: the records to add, and (after a check) how DNS looks. */
export function domainView(row: CustomDomainRow, dns?: DnsCheck) {
  return {
    domain: row.domain,
    verified: row.verified_at !== null,
    // The two records the owner adds at their DNS provider.
    records: {
      txt: { name: txtName(row.domain), value: txtValue(row.token) },
      cname: { name: row.domain, target: ourHost() },
    },
    dns: dns ?? null,
  };
}

// ---------- claims ----------

/** What a domain shows: one site's status page, or (Agency) one client's. */
export type Subject = { monitorId: number } | { clientId: number };
const column = (s: Subject) => ("clientId" in s ? "client_id" : "monitor_id");
const idOf = (s: Subject) => ("clientId" in s ? s.clientId : s.monitorId);

export function getDomainFor(monitorId: number, userId: number): CustomDomainRow | undefined {
  return getDomain({ monitorId }, userId);
}
export function getDomain(subject: Subject, userId: number): CustomDomainRow | undefined {
  return db().prepare(`SELECT * FROM custom_domains WHERE ${column(subject)} = ? AND user_id = ?`).get(idOf(subject), userId) as unknown as CustomDomainRow | undefined;
}

export type ClaimResult = { ok: true; row: CustomDomainRow } | { ok: false; error: string };

/** Starts (or replaces) the claim on a status page's domain. Nothing is served until it's verified. */
export function claimDomain(userId: number, monitorId: number, domain: string, now = Date.now()): ClaimResult {
  return claim(userId, { monitorId }, domain, now);
}

export function claimClientDomain(userId: number, clientId: number, domain: string, now = Date.now()): ClaimResult {
  return claim(userId, { clientId }, domain, now);
}

function claim(userId: number, subject: Subject, domain: string, now: number): ClaimResult {
  const conn = db();
  const col = column(subject);
  const taken = conn.prepare("SELECT user_id FROM custom_domains WHERE domain = ? AND verified_at IS NOT NULL").get(domain) as { user_id: number } | undefined;
  if (taken && taken.user_id !== userId) return { ok: false, error: "That domain is already connected to another account." };
  const mine = conn.prepare(`SELECT id FROM custom_domains WHERE domain = ? AND user_id = ? AND (${col} IS NULL OR ${col} != ?)`).get(domain, userId, idOf(subject));
  if (mine) return { ok: false, error: `You're already using that domain for another ${"clientId" in subject ? "page" : "site"}.` };

  conn.prepare(`DELETE FROM custom_domains WHERE ${col} = ?`).run(idOf(subject));
  const token = randomBytes(16).toString("hex");
  conn.prepare(`INSERT INTO custom_domains (user_id, ${col}, domain, token, created_at) VALUES (?, ?, ?, ?, ?)`).run(userId, idOf(subject), domain, token, now);
  return { ok: true, row: getDomain(subject, userId) as CustomDomainRow };
}

export function removeDomain(monitorId: number, userId: number): boolean {
  return Number(db().prepare("DELETE FROM custom_domains WHERE monitor_id = ? AND user_id = ?").run(monitorId, userId).changes) > 0;
}

export function removeClientDomain(clientId: number, userId: number): boolean {
  return Number(db().prepare("DELETE FROM custom_domains WHERE client_id = ? AND user_id = ?").run(clientId, userId).changes) > 0;
}

export type VerifyResult = { ok: true; row: CustomDomainRow; dns: DnsCheck } | { ok: false; error: string };

/** Checks DNS for a claim and, if the proof record is there, makes the domain this account's. */
export async function verifyDomain(monitorId: number, userId: number, resolver: DnsResolver = systemResolver, now = Date.now()): Promise<VerifyResult> {
  return verify({ monitorId }, userId, resolver, now);
}

export async function verifyClientDomain(clientId: number, userId: number, resolver: DnsResolver = systemResolver, now = Date.now()): Promise<VerifyResult> {
  return verify({ clientId }, userId, resolver, now);
}

async function verify(subject: Subject, userId: number, resolver: DnsResolver, now: number): Promise<VerifyResult> {
  const row = getDomain(subject, userId);
  if (!row) return { ok: false, error: `No domain has been set up for this ${"clientId" in subject ? "client" : "site"}.` };
  const result = await checkDns(row.domain, row.token, resolver);
  const conn = db();

  if (result.txt === "found" && row.verified_at === null) {
    try {
      conn.prepare("UPDATE custom_domains SET verified_at = ?, last_check_at = ?, fail_count = 0 WHERE id = ?").run(now, now, row.id);
    } catch (err) {
      // Someone else proved this domain a moment ago.
      if ((err as { errcode?: number }).errcode === 2067) return { ok: false, error: "That domain was just connected to another account." };
      throw err;
    }
    // Everyone else's claims on this name can never be verified now, so clear them out.
    conn.prepare("DELETE FROM custom_domains WHERE domain = ? AND id != ?").run(row.domain, row.id);
  } else if (row.verified_at !== null) {
    conn.prepare("UPDATE custom_domains SET last_check_at = ?, fail_count = ? WHERE id = ?").run(now, result.txt === "found" ? 0 : row.fail_count, row.id);
  }
  return { ok: true, row: getDomain(subject, userId) as CustomDomainRow, dns: result };
}

// ---------- serving ----------

export interface ServedDomain {
  domain: string;
  userId: number;
  /** Set when the domain shows one site's status page. */
  monitorId: number | null;
  /** Set when the domain shows a client's status page (Agency). */
  clientId: number | null;
  slug: string | null;
  statusPublic: boolean;
  ownerPlan: string;
}

/** The verified domain for a host, and the page it should show. Null for anything that isn't a verified custom domain. */
export function lookupVerifiedDomain(host: string): ServedDomain | null {
  const h = host.toLowerCase().replace(/:\d+$/, "");
  const row = db()
    .prepare(
      `SELECT d.domain, d.user_id AS userId, d.monitor_id AS monitorId, d.client_id AS clientId,
              COALESCE(m.status_slug, c.status_slug) AS slug, COALESCE(m.status_public, c.status_public) AS pub, u.plan AS ownerPlan
       FROM custom_domains d
       JOIN users u ON u.id = d.user_id
       LEFT JOIN monitors m ON m.id = d.monitor_id
       LEFT JOIN clients c ON c.id = d.client_id
       WHERE d.domain = ? AND d.verified_at IS NOT NULL`,
    )
    .get(h) as { domain: string; userId: number; monitorId: number | null; clientId: number | null; slug: string | null; pub: number | null; ownerPlan: string } | undefined;
  return row ? { domain: row.domain, userId: row.userId, monitorId: row.monitorId, clientId: row.clientId, slug: row.slug, statusPublic: row.pub === 1, ownerPlan: row.ownerPlan } : null;
}

/** The verified domain a monitor's status page is shown on, if any. */
export function lookupDomainFor(monitorId: number): string | null {
  const row = db().prepare("SELECT domain FROM custom_domains WHERE monitor_id = ? AND verified_at IS NOT NULL").get(monitorId) as { domain: string } | undefined;
  return row?.domain ?? null;
}

// ---------- staying owned ----------

/**
 * Re-checks the proof record of each verified domain that hasn't been checked in a day. A domain whose record has been
 * missing for several checks in a row is released (back to an unverified claim). A DNS error says nothing about the
 * record, so it counts as neither found nor missing.
 */
export async function recheckVerifiedDomains(resolver: DnsResolver = systemResolver, now = Date.now()): Promise<{ checked: number; released: string[] }> {
  const due = db()
    .prepare("SELECT * FROM custom_domains WHERE verified_at IS NOT NULL AND (last_check_at IS NULL OR last_check_at <= ?)")
    .all(now - DAY) as unknown as CustomDomainRow[];
  const released: string[] = [];
  for (const row of due) {
    const txt = await checkTxt(row.domain, row.token, resolver);
    if (txt === "error") continue;
    const misses = txt === "found" ? 0 : row.fail_count + 1;
    if (misses >= RELEASE_AFTER_MISSES) {
      db().prepare("UPDATE custom_domains SET verified_at = NULL, fail_count = 0, last_check_at = ? WHERE id = ?").run(now, row.id);
      released.push(row.domain);
    } else {
      db().prepare("UPDATE custom_domains SET last_check_at = ?, fail_count = ? WHERE id = ?").run(now, misses, row.id);
    }
  }
  return { checked: due.length, released };
}
