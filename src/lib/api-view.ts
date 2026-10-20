import { entitlementsFor } from "./entitlements";
import { type MonitorRow, dailyHistory } from "./monitors-db";
import { monitorView } from "./monitor-view";

const DAY = 86_400_000;

/** A monitor as the API and exports describe it: stable field names, nothing internal. */
export function apiMonitor(m: MonitorRow, plan: string) {
  const v = monitorView(m, entitlementsFor(plan));
  const site = m.kind === "site";
  return {
    id: m.id,
    kind: m.kind,
    name: m.host,
    status: v.overall,
    target: m.kind === "http" ? { url: m.url, keyword: m.keyword, keywordMode: m.keyword_mode } : m.kind === "tcp" ? { host: m.url, port: m.port } : null,
    uptime: {
      status: v.uptime.status,
      httpStatus: v.uptime.code,
      responseMs: v.uptime.ms,
      error: v.uptime.error,
      downSince: v.uptime.downSince,
      last24h: v.uptime.pct24h,
      last30d: v.uptime.pct30d,
      checkedAt: v.uptime.checkedAt,
    },
    ssl: site ? { status: v.ssl.status, daysLeft: v.ssl.days, expiresAt: v.ssl.expiresAt, issuer: v.ssl.issuer } : null,
    domain: site ? { status: v.domain.status, daysLeft: v.domain.days, expiresAt: v.domain.expiresAt, registrar: v.domain.registrar } : null,
    heartbeat: m.kind === "heartbeat" ? { lastPingAt: m.hb_last_ping, everyMs: m.hb_every_ms, graceMs: m.hb_grace_ms } : null,
    statusPage: m.status_public && m.status_slug ? { slug: m.status_slug } : null,
    createdAt: m.created_at,
  };
}

/** Daily uptime for the last `days` days (capped by the plan), oldest first. */
export function apiHistory(monitorId: number, plan: string, days: number, now = Date.now()) {
  const n = Math.max(1, Math.min(Math.floor(days) || 30, entitlementsFor(plan).historyDays));
  const today = Math.floor(now / DAY) * DAY;
  return dailyHistory(monitorId, today - (n - 1) * DAY, today + DAY).map((d) => ({
    date: new Date(d.day).toISOString().slice(0, 10),
    checks: d.total,
    up: d.ok,
    uptime: d.total ? Math.round((d.ok / d.total) * 100_000) / 1000 : null,
    avgResponseMs: d.avgMs,
  }));
}
