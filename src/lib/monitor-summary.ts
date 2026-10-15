import { monitorView } from "./monitor-view";
import type { MonitorRow } from "./monitors-db";

const OVERALL_TEXT = {
  ok: "All good",
  warning: "Needs attention soon",
  problem: "Problem found",
  down: "Down",
  pending: "Still being checked",
} as const;

const date = (ms: number | null) =>
  ms ? new Date(ms).toLocaleDateString("en-US", { year: "numeric", month: "long", day: "numeric", timeZone: "UTC" }) : "an unknown date";

const daysLeft = (days: number | null) =>
  days === null ? "" : days < 0 ? `expired ${Math.abs(days)} days ago` : days === 1 ? "1 day left" : `${days} days left`;

/** The current health of a monitor in plain words: one overall verdict and a line for each check. */
export function describeHealth(m: MonitorRow): { overall: string; lines: string[] } {
  const v = monitorView(m);
  const lines: string[] = [];

  // Uptime
  if (v.uptime.status === "pending") lines.push("Uptime: not checked yet");
  else if (v.uptime.status === "down") lines.push(`Uptime: down (${v.uptime.error ?? "no response"})`);
  else lines.push(`Uptime: up (HTTP ${v.uptime.code ?? "?"}, ${v.uptime.ms ?? "?"} ms)`);

  // SSL certificate
  const s = v.ssl;
  if (s.status === "pending") lines.push("SSL certificate: not checked yet");
  else if (s.status === "unreachable") lines.push(`SSL certificate: couldn't be checked (${s.error ?? "couldn't connect"})`);
  else if (s.status === "invalid") lines.push(`SSL certificate: problem (${s.problems.join("; ") || "failed verification"})`);
  else {
    const issuer = s.issuer ? `, issued by ${s.issuer}` : "";
    lines.push(`SSL certificate: ${daysLeft(s.days)} (${s.days !== null && s.days < 0 ? "expired" : "expires"} ${date(s.expiresAt)}${issuer})`);
  }

  // Domain registration
  const d = v.domain;
  if (d.status === "pending") lines.push("Domain registration: not checked yet");
  else if (d.status === "unsupported") lines.push("Domain registration: expiry date isn't published for this domain extension");
  else if (d.status === "unknown") lines.push("Domain registration: expiry date isn't published");
  else if (d.status === "error") lines.push(`Domain registration: couldn't be checked${d.note ? ` (${d.note})` : ""}`);
  else {
    const registrar = d.registrar ? `, registrar ${d.registrar}` : "";
    lines.push(`Domain registration: ${daysLeft(d.days)} (${d.days !== null && d.days < 0 ? "expired" : "expires"} ${date(d.expiresAt)}${registrar})`);
  }

  return { overall: OVERALL_TEXT[v.overall], lines };
}
