import { randomBytes } from "node:crypto";
import { uptimeByDay, uptimeSince, openIncidentSince, recentIncidents, type MonitorRow } from "./monitors-db";

const DAY = 86_400_000;
export const SLUG_PATTERN = /^[a-z2-7]{12}$/;

/** A random address for a status page: 12 characters of base32, about 60 bits, so it can't be guessed or counted through. */
export function newSlug(): string {
  const alphabet = "abcdefghijklmnopqrstuvwxyz234567";
  return Array.from(randomBytes(12), (b) => alphabet[b % 32]).join("");
}

const pct = (w: { total: number; ok: number }): number | null => (w.total === 0 ? null : Math.round((w.ok / w.total) * 10_000) / 100);

export type PublicStatus = "operational" | "down" | "checking";

/**
 * What a status page may show to anyone on the internet. This is the ONLY place that decides, and it
 * is deliberately small: the site's name, whether it's up, uptime figures and past outages. It never
 * includes error messages, certificate or domain details, or anything about the account.
 */
export function publicStatus(m: MonitorRow, now = Date.now()) {
  const downSince = openIncidentSince(m.id);
  const status: PublicStatus = downSince !== null ? "down" : m.up_status === "pending" ? "checking" : "operational";

  // The last 30 days, one entry per UTC day, today included. Days with no data are null, not 100%.
  const today = Math.floor(now / DAY) * DAY;
  const byDay = new Map(uptimeByDay(m.id, today - 29 * DAY).map((d) => [d.day, d]));
  const days = Array.from({ length: 30 }, (_, i) => {
    const day = today - (29 - i) * DAY;
    const d = byDay.get(day);
    return { day, uptime: d ? pct(d) : null };
  });

  return {
    host: m.host,
    status,
    downSince,
    lastCheckedAt: m.up_checked_at,
    responseMs: status === "operational" ? m.up_ms : null,
    uptime: {
      last24h: pct(uptimeSince(m.id, now - DAY)),
      last7d: pct(uptimeSince(m.id, now - 7 * DAY)),
      last30d: pct(uptimeSince(m.id, now - 30 * DAY)),
    },
    days,
    incidents: recentIncidents(m.id, now - 30 * DAY, 10).map((i) => ({
      startedAt: i.started_at,
      endedAt: i.ended_at,
    })),
  };
}
