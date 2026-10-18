import { appUrl } from "./mail";

// Pure rules: given what a monitor knew before and what a check just found, decide what to email.
// No network or database here, so every rule can be tested directly.

export const SSL_THRESHOLDS = [30, 14, 7, 3, 1];
export const DOMAIN_THRESHOLDS = [60, 30, 14, 7, 1];
/** A site is only reported down after this many failed checks in a row, so one blip emails nobody. */
export const DOWN_AFTER_FAILURES = 2;

export type AlertKind = "ssl_expiry" | "ssl_problem" | "domain_expiry" | "down" | "recovered" | "ai_problem" | "ai_recovered";

export interface Alert {
  kind: AlertKind;
  /** Email subject, also shown in the dashboard's activity list. */
  subject: string;
  body: string;
}

/**
 * Which warning stage a number of days falls in: the smallest threshold that is at least `days`,
 * 0 once expired, or null when it's further away than every threshold.
 */
export function bucketFor(days: number, thresholds: number[]): number | null {
  if (days < 0) return 0;
  const sorted = [...thresholds].sort((a, b) => a - b);
  return sorted.find((t) => days <= t) ?? null;
}

/** True when we've moved into a stage we haven't emailed about yet. */
function shouldAlert(bucket: number | null, alreadySent: number | null): boolean {
  return bucket !== null && (alreadySent === null || bucket < alreadySent);
}

const plural = (n: number, word: string) => `${n} ${word}${n === 1 ? "" : "s"}`;
const dashboardLink = () => `${appUrl()}/dashboard`;
const footer = () => `\n\nSee all your monitors: ${dashboardLink()}\nYou're getting this because you're watching this site on your account.`;
const fmtDate = (ms: number) => new Date(ms).toLocaleDateString("en-US", { year: "numeric", month: "long", day: "numeric", timeZone: "UTC" });

// ---------- SSL ----------

export interface SslState {
  bucket: number | null;
  problemSig: string | null;
}
export interface SslFinding {
  status: "valid" | "expiring" | "expired" | "invalid";
  days: number;
  expiresAt: number;
  issuer: string;
  problems: string[];
}

export function evaluateSsl(prev: SslState, host: string, r: SslFinding): { state: SslState; alerts: Alert[] } {
  const alerts: Alert[] = [];
  const bucket = bucketFor(r.days, SSL_THRESHOLDS);
  let problemSig = prev.problemSig;

  if (shouldAlert(bucket, prev.bucket)) {
    if (r.days < 0) {
      alerts.push({
        kind: "ssl_expiry",
        subject: `The SSL certificate for ${host} has expired`,
        body:
          `The SSL certificate for ${host} expired on ${fmtDate(r.expiresAt)}. ` +
          `Visitors will see a security warning until it is renewed.\n\nIssuer: ${r.issuer}` + footer(),
      });
    } else {
      alerts.push({
        kind: "ssl_expiry",
        subject: `The SSL certificate for ${host} expires in ${plural(r.days, "day")}`,
        body:
          `The SSL certificate for ${host} expires on ${fmtDate(r.expiresAt)}, in ${plural(r.days, "day")}.\n\n` +
          `Issuer: ${r.issuer}\n\nRenew it before then to avoid a security warning for visitors.` + footer(),
      });
    }
  }

  // Expiry has its own alert, so only unrelated problems (wrong hostname, broken chain...) count here.
  if (r.status === "invalid" && r.problems.length > 0) {
    const sig = r.problems.join(" | ");
    if (sig !== prev.problemSig) {
      alerts.push({
        kind: "ssl_problem",
        subject: `SSL problem found on ${host}`,
        body: `We found a problem with the SSL certificate on ${host}:\n\n${r.problems.map((p) => `- ${p}`).join("\n")}` + footer(),
      });
      problemSig = sig;
    }
  } else if (r.status === "valid" || r.status === "expiring") {
    problemSig = null; // fixed, so a future problem is news again
  }

  return { state: { bucket, problemSig }, alerts };
}

// ---------- domain registration ----------

export interface DomainFinding {
  domain: string;
  days: number;
  expiresAt: number;
  registrar: string | null;
}

export function evaluateDomain(prevBucket: number | null, host: string, r: DomainFinding): { bucket: number | null; alerts: Alert[] } {
  const bucket = bucketFor(r.days, DOMAIN_THRESHOLDS);
  const alerts: Alert[] = [];
  if (shouldAlert(bucket, prevBucket)) {
    const registrar = r.registrar ? `\nRegistrar: ${r.registrar}` : "";
    alerts.push(
      r.days < 0
        ? {
            kind: "domain_expiry",
            subject: `The domain ${r.domain} has expired`,
            body:
              `The registration for ${r.domain} expired on ${fmtDate(r.expiresAt)}. The site and email on it may stop working. ` +
              `Renew it with your registrar as soon as possible.${registrar}` + footer(),
          }
        : {
            kind: "domain_expiry",
            subject: `The domain ${r.domain} expires in ${plural(r.days, "day")}`,
            body:
              `The registration for ${r.domain} expires on ${fmtDate(r.expiresAt)}, in ${plural(r.days, "day")}. ` +
              `Renew it with your registrar to keep the site and email running.${registrar}` + footer(),
          },
    );
  }
  // Remember the current stage. A renewal moves it back out, so the next approach is announced again.
  return { bucket, alerts };
}

// ---------- uptime ----------

export interface UptimeState {
  failures: number;
  downAlerted: boolean;
  downSince: number | null;
}
export interface UptimeFinding {
  up: boolean;
  status: number | null;
  error: string | null;
}

const duration = (ms: number) => {
  const mins = Math.max(1, Math.round(ms / 60_000));
  if (mins < 60) return plural(mins, "minute");
  const hours = Math.floor(mins / 60);
  return hours < 24 ? `${plural(hours, "hour")}${mins % 60 ? ` ${plural(mins % 60, "minute")}` : ""}` : plural(Math.round(hours / 24), "day");
};

export function evaluateUptime(prev: UptimeState, host: string, r: UptimeFinding, now: number): { state: UptimeState; alerts: Alert[]; recheckSoon: boolean } {
  if (r.up) {
    const alerts: Alert[] = [];
    if (prev.downAlerted) {
      alerts.push({
        kind: "recovered",
        subject: `${host} is back up`,
        body: `${host} is responding again.${prev.downSince ? ` It was down for about ${duration(now - prev.downSince)}.` : ""}` + footer(),
      });
    }
    return { state: { failures: 0, downAlerted: false, downSince: null }, alerts, recheckSoon: false };
  }

  const failures = prev.failures + 1;
  const downSince = prev.downSince ?? now;
  if (failures >= DOWN_AFTER_FAILURES && !prev.downAlerted) {
    return {
      state: { failures, downAlerted: true, downSince },
      alerts: [
        {
          kind: "down",
          subject: `${host} is down`,
          body: `${host} didn't respond to ${failures} checks in a row.\n\nLast error: ${r.error ?? "no response"}\n\nWe'll email you again when it's back up.` + footer(),
        },
      ],
      recheckSoon: false,
    };
  }
  return { state: { failures, downAlerted: prev.downAlerted, downSince }, alerts: [], recheckSoon: failures < DOWN_AFTER_FAILURES };
}

// ---------- AI visibility ----------

export interface AiAlertState {
  /** The set of problems we last told the owner about, or null if none is outstanding. */
  alertedSig: string | null;
  /** A set of problems seen once and waiting for a second look before anyone is told. */
  pendingSig: string | null;
}

/**
 * Decides whether to email about AI visibility. `sig` identifies the current set of problems and is empty when
 * there are none. A new set of problems is only reported once a second look, an hour later, finds the same
 * ones, so a short glitch (a firewall rule being changed, a deploy) emails nobody. Problems going away is
 * reported straight away, but only if we had reported them.
 */
export function evaluateAi(
  prev: AiAlertState,
  host: string,
  r: { sig: string; problems: { title: string; detail: string }[] },
): { state: AiAlertState; alerts: Alert[]; recheckSoon: boolean } {
  if (!r.sig) {
    const alerts: Alert[] = prev.alertedSig
      ? [
          {
            kind: "ai_recovered",
            subject: `AI search tools can read ${host} again`,
            body: `The problems we reported about AI search access to ${host} are gone. Crawlers that build AI search results are no longer being turned away.${footer()}`,
          },
        ]
      : [];
    return { state: { alertedSig: null, pendingSig: null }, alerts, recheckSoon: false };
  }
  if (r.sig === prev.alertedSig) return { state: { alertedSig: prev.alertedSig, pendingSig: null }, alerts: [], recheckSoon: false };
  if (r.sig !== prev.pendingSig) return { state: { alertedSig: prev.alertedSig, pendingSig: r.sig }, alerts: [], recheckSoon: true };

  const list = r.problems.map((p) => `• ${p.title}\n  ${p.detail}`).join("\n\n");
  return {
    state: { alertedSig: r.sig, pendingSig: null },
    recheckSoon: false,
    alerts: [
      {
        kind: "ai_problem",
        subject: `AI search tools may not be able to read ${host}`,
        body:
          `We found ${plural(r.problems.length, "thing")} that can keep AI search tools from reading ${host}:\n\n${list}\n\n` +
          `This checks whether the site can be read. It can't tell you whether any AI tool actually mentions it.` +
          footer(),
      },
    ],
  };
}
