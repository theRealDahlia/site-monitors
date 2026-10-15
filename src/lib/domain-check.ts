import { CheckError, parseHostname } from "./hostname";

export type DomainState = "ok" | "expiring" | "expired" | "unknown";

export interface DomainResult {
  /** The domain the user typed, as normalised. */
  input: string;
  /** The registered domain that the registry returned data for. */
  domain: string;
  state: DomainState;
  problems: string[];
  registrar: string | null;
  registeredAt: string | null;
  expiresAt: string | null;
  updatedAt: string | null;
  daysRemaining: number | null;
  statuses: string[];
  nameservers: string[];
  dnssecSigned: boolean | null;
  checkedAt: string;
}

const BOOTSTRAP_URL = "https://data.iana.org/rdap/dns.json";
const BOOTSTRAP_TTL_MS = 24 * 60 * 60 * 1000;
const REQUEST_TIMEOUT_MS = 8000;
const EXPIRING_DAYS = 60;
const MAX_CANDIDATES = 4;

let bootstrap: { at: number; byTld: Map<string, string> } | null = null;

async function getRdapBase(tld: string): Promise<string | null> {
  if (!bootstrap || Date.now() - bootstrap.at > BOOTSTRAP_TTL_MS) {
    let data: { services?: [string[], string[]][] };
    try {
      const res = await fetch(BOOTSTRAP_URL, { signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS) });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      data = await res.json();
    } catch {
      if (bootstrap) return bootstrap.byTld.get(tld) ?? null; // stale copy beats failing
      throw new CheckError("Couldn't load the registry directory. Try again shortly.", 502);
    }
    const byTld = new Map<string, string>();
    for (const [tlds, urls] of data.services ?? []) {
      const url = urls.find((u) => u.startsWith("https://")) ?? null;
      if (!url) continue;
      for (const t of tlds) byTld.set(t.toLowerCase(), url.endsWith("/") ? url : `${url}/`);
    }
    bootstrap = { at: Date.now(), byTld };
  }
  return bootstrap.byTld.get(tld) ?? null;
}

interface RdapEvent {
  eventAction?: string;
  eventDate?: string;
}
interface RdapEntity {
  roles?: string[];
  handle?: string;
  vcardArray?: [string, [string, unknown, string, unknown][]];
  entities?: RdapEntity[];
}
interface RdapDomain {
  status?: string[];
  events?: RdapEvent[];
  entities?: RdapEntity[];
  nameservers?: { ldhName?: string }[];
  secureDNS?: { delegationSigned?: boolean };
}

function eventDate(events: RdapEvent[] | undefined, ...actions: string[]): string | null {
  for (const action of actions) {
    const found = events?.find((e) => e.eventAction?.toLowerCase() === action && e.eventDate);
    if (found?.eventDate) {
      const d = new Date(found.eventDate);
      if (!Number.isNaN(d.getTime())) return d.toISOString();
    }
  }
  return null;
}

function registrarName(entities: RdapEntity[] | undefined): string | null {
  const registrar = entities?.find((e) => e.roles?.includes("registrar"));
  if (!registrar) return null;
  const fn = registrar.vcardArray?.[1]?.find((p) => p[0] === "fn")?.[3];
  if (typeof fn === "string" && fn.trim()) return fn.trim();
  return registrar.handle ?? null;
}

const STATUS_PROBLEMS: Record<string, string> = {
  redemptionperiod:
    "The domain has expired and is in its redemption period. The owner can usually still recover it, but only for an extra fee.",
  pendingdelete: "The domain is pending deletion and will be released for anyone to register.",
  clienthold: "The registrar has put this domain on hold, so it won't resolve.",
  serverhold: "The registry has put this domain on hold, so it won't resolve.",
};

async function lookup(base: string, name: string): Promise<RdapDomain | null> {
  let res: Response;
  try {
    res = await fetch(`${base}domain/${name}`, {
      headers: { Accept: "application/rdap+json, application/json" },
      signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
    });
  } catch {
    throw new CheckError("The registry didn't respond in time. Try again shortly.", 504);
  }
  if (res.status === 404) return null;
  if (res.status === 429) {
    throw new CheckError("The registry is limiting requests right now. Try again in a minute.", 503);
  }
  if (!res.ok) throw new CheckError(`The registry returned an error (HTTP ${res.status}).`, 502);
  try {
    return (await res.json()) as RdapDomain;
  } catch {
    throw new CheckError("The registry returned data we couldn't read.", 502);
  }
}

export async function checkDomain(input: string): Promise<DomainResult> {
  const host = parseHostname(input, { ignorePort: true });
  const labels = host.split(".");
  const tld = labels[labels.length - 1];

  const base = await getRdapBase(tld);
  if (!base) {
    throw new CheckError(
      `.${tld} domains don't publish public expiry data through RDAP, so we can't check them here.`,
      400,
      "unsupported_tld",
    );
  }

  // The user may have typed a subdomain (www.example.com) or a multi-part suffix (example.co.uk),
  // so try the full name first and strip leading labels until the registry recognises one.
  let data: RdapDomain | null = null;
  let domain = host;
  for (let i = 0; i < MAX_CANDIDATES && labels.length - i >= 2; i++) {
    domain = labels.slice(i).join(".");
    data = await lookup(base, domain);
    if (data) break;
  }
  if (!data) {
    throw new CheckError(`${host} doesn't appear to be registered, or the registry has no record of it.`, 404);
  }

  const expiresAt = eventDate(data.events, "expiration");
  const daysRemaining = expiresAt
    ? Math.floor((new Date(expiresAt).getTime() - Date.now()) / 86_400_000)
    : null;

  const statuses = (data.status ?? []).map((s) => s.trim()).filter(Boolean);
  const problems: string[] = [];
  for (const s of statuses) {
    const message = STATUS_PROBLEMS[s.toLowerCase().replace(/[\s_-]/g, "")];
    if (message && !problems.includes(message)) problems.push(message);
  }

  let state: DomainState = "ok";
  if (daysRemaining === null) state = "unknown";
  else if (daysRemaining < 0) state = "expired";
  else if (daysRemaining <= EXPIRING_DAYS) state = "expiring";

  if (state === "expiring") {
    problems.unshift(`The domain expires in ${daysRemaining} day${daysRemaining === 1 ? "" : "s"}.`);
  } else if (state === "expired") {
    problems.unshift(`The domain's expiry date passed ${Math.abs(daysRemaining!)} days ago.`);
  } else if (state === "unknown") {
    problems.unshift("This registry doesn't publish an expiry date for this domain.");
  }

  return {
    input: host,
    domain,
    state,
    problems,
    registrar: registrarName(data.entities),
    registeredAt: eventDate(data.events, "registration"),
    expiresAt,
    updatedAt: eventDate(data.events, "last changed", "last update of rdap database"),
    daysRemaining,
    statuses,
    nameservers: (data.nameservers ?? [])
      .map((n) => n.ldhName?.toLowerCase())
      .filter((n): n is string => !!n),
    dnssecSigned: data.secureDNS?.delegationSigned ?? null,
    checkedAt: new Date().toISOString(),
  };
}
