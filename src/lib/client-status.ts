import { type ClientRow, clientMonitors } from "./clients";
import { type NoticeView, publicNotices } from "./status-notices";
import { type PublicStatus, publicStatus } from "./status-page";

type WithHost = NoticeView & { host: string };

/**
 * What a client's status page shows anyone: each of its monitors the way a site's own page would show it, and the
 * incidents and maintenance the owner has posted for any of them. Like publicStatus, this is the only place that decides.
 */
export function publicClientStatus(client: ClientRow, now = Date.now()) {
  const monitors = clientMonitors(client.id, client.user_id);
  const rank = { down: 0, checking: 1, operational: 2 } satisfies Record<PublicStatus, number>;
  const sites = monitors
    .map((m) => ({ id: m.id, ...publicStatus(m, now) }))
    .sort((a, b) => rank[a.status] - rank[b.status] || a.host.localeCompare(b.host));

  const merged: Record<"active" | "upcoming" | "past", WithHost[]> = { active: [], upcoming: [], past: [] };
  for (const m of monitors) {
    const n = publicNotices(m.id, now);
    for (const key of ["active", "upcoming", "past"] as const) merged[key].push(...n[key].map((x) => ({ ...x, host: m.host })));
  }
  merged.upcoming.sort((a, b) => (a.startsAt ?? 0) - (b.startsAt ?? 0));
  merged.past.sort((a, b) => b.createdAt - a.createdAt);
  merged.past.splice(10);

  const status: PublicStatus = sites.some((s) => s.status === "down") ? "down" : sites.length && sites.every((s) => s.status === "checking") ? "checking" : "operational";
  return { type: "client" as const, name: client.name, status, sites, notices: merged };
}
