import type { AiResult } from "./ai-bots";
import { type MonitorRow, uptimeSince } from "./monitors-db";

export type OverallStatus = "pending" | "ok" | "warning" | "problem" | "down";

const DAY = 24 * 60 * 60 * 1000;

function percent(window: { total: number; ok: number }): number | null {
  return window.total === 0 ? null : Math.round((window.ok / window.total) * 1000) / 10;
}

/** The stored AI result, or null if there isn't one or it's from a version we don't recognise. */
function parseAi(json: string | null): AiResult | null {
  if (!json) return null;
  try {
    const v = JSON.parse(json) as AiResult;
    return v && v.v === 1 ? v : null;
  } catch {
    return null;
  }
}

/**
 * The shape sent to the dashboard: current state of each check plus one overall status. AI-visibility results
 * are only included for accounts whose plan has them (`opts.aiVisibility`); everyone else gets `ai: null`.
 */
export function monitorView(m: MonitorRow, opts: { aiVisibility?: boolean } = {}) {
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
    ai: opts.aiVisibility ? { status: m.ai_status, checkedAt: m.ai_checked_at, result: parseAi(m.ai_result) } : null,
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
