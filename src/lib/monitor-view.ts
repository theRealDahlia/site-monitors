import { type MonitorRow, uptimeSince } from "./monitors-db";

export type OverallStatus = "pending" | "ok" | "warning" | "problem" | "down";

const DAY = 24 * 60 * 60 * 1000;

function percent(window: { total: number; ok: number }): number | null {
  return window.total === 0 ? null : Math.round((window.ok / window.total) * 1000) / 10;
}

/** The shape sent to the dashboard: current state of each check plus one overall status. */
export function monitorView(m: MonitorRow) {
  const now = Date.now();

  let overall: OverallStatus = "ok";
  if (m.up_status === "down") overall = "down";
  else if (m.ssl_status === "expired" || m.ssl_status === "invalid" || m.dom_status === "expired") overall = "problem";
  else if (m.ssl_status === "expiring" || m.dom_status === "expiring") overall = "warning";
  else if (m.up_status === "pending") overall = "pending";

  return {
    id: m.id,
    host: m.host,
    createdAt: m.created_at,
    overall,
    statusPage: { enabled: !!m.status_public, slug: m.status_slug },
    uptime: {
      status: m.up_status,
      code: m.up_code,
      ms: m.up_ms,
      error: m.up_error,
      checkedAt: m.up_checked_at,
      downSince: m.down_since,
      pct24h: percent(uptimeSince(m.id, now - DAY)),
      pct30d: percent(uptimeSince(m.id, now - 30 * DAY)),
    },
    ssl: {
      status: m.ssl_status,
      days: m.ssl_days,
      expiresAt: m.ssl_expires_at,
      issuer: m.ssl_issuer,
      problems: m.ssl_problems ? (JSON.parse(m.ssl_problems) as string[]) : [],
      error: m.ssl_error,
      checkedAt: m.ssl_checked_at,
    },
    domain: {
      status: m.dom_status,
      name: m.dom_name,
      days: m.dom_days,
      expiresAt: m.dom_expires_at,
      registrar: m.dom_registrar,
      note: m.dom_note,
      checkedAt: m.dom_checked_at,
    },
  };
}
