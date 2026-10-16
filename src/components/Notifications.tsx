"use client";

import DashboardTabs from "@/components/DashboardTabs";
import { type EventItem, ago, useMonitors } from "@/components/monitor-ui";

// What each kind of notification is called, and how serious it looks.
const KINDS: Record<string, { label: string; tone: string }> = {
  created: { label: "Site added", tone: "bg-ok-bg text-ok" },
  edited: { label: "Site edited", tone: "bg-accent/15 text-accent" },
  removed: { label: "Site removed", tone: "border border-border text-muted" },
  recovered: { label: "Back up", tone: "bg-ok-bg text-ok" },
  ssl_expiry: { label: "SSL expiry", tone: "bg-warn-bg text-warn" },
  domain_expiry: { label: "Domain expiry", tone: "bg-warn-bg text-warn" },
  ssl_problem: { label: "SSL problem", tone: "bg-bad-bg text-bad" },
  down: { label: "Site down", tone: "bg-bad-bg text-bad" },
};
const FALLBACK = { label: "Notice", tone: "border border-border text-muted" };

function Item({ e, email }: { e: EventItem; email: string }) {
  const kind = KINDS[e.kind] ?? FALLBACK;
  const when = new Date(e.at);
  return (
    <li className="px-4 py-4 sm:px-5">
      <div className="flex flex-wrap items-start justify-between gap-x-4 gap-y-2">
        <div className="min-w-0">
          <span className={`inline-block rounded-full px-2.5 py-0.5 text-xs font-medium ${kind.tone}`}>{kind.label}</span>
          <p className="mt-2 break-words font-medium">{e.message}</p>
          <p className="mt-1 break-all text-sm text-muted">{e.host}</p>
          {e.details && (
            <p className="mt-3 whitespace-pre-line break-words rounded-lg border border-border bg-background px-3 py-2.5 text-sm text-muted">
              {e.details}
            </p>
          )}
        </div>
        <div className="shrink-0 text-left text-xs text-muted sm:text-right">
          <p title={when.toLocaleString()}>{ago(e.at)}</p>
          <p className="mt-0.5">{when.toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" })}</p>
        </div>
      </div>
      <p className={`mt-2 text-xs ${e.emailed ? "text-muted" : "text-warn"}`}>
        {e.emailed ? `Emailed to ${email}` : "Not emailed"}
      </p>
    </li>
  );
}

// ---------- the Notifications tab ----------

export default function Notifications() {
  const { data, loadError } = useMonitors("/dashboard/notifications");

  if (!data) {
    return loadError ? (
      <p role="alert" className="rounded-lg bg-bad-bg px-4 py-3 text-sm text-bad">
        {loadError}
      </p>
    ) : (
      <p className="text-muted">Loading your notifications…</p>
    );
  }

  return (
    <div>
      <h1 className="text-3xl font-semibold tracking-tight">Dashboard</h1>
      <p className="mt-2 text-muted">
        Every alert and confirmation we&apos;ve emailed to <span className="font-medium text-foreground">{data.email}</span>.
      </p>

      <DashboardTabs />

      {loadError && (
        <p role="alert" className="mt-4 rounded-lg bg-warn-bg px-4 py-3 text-sm text-warn">
          {loadError}
        </p>
      )}

      <section className="mt-6" aria-labelledby="notifications-heading">
        <h2 id="notifications-heading" className="sr-only">
          Notifications
        </h2>
        {data.events.length === 0 ? (
          <div className="rounded-xl border border-dashed border-border p-8 text-center">
            <p className="font-medium">No notifications yet</p>
            <p className="mt-1 text-sm text-muted">
              When we email you about a site, like a confirmation, an expiring certificate or an outage, it shows up here.
            </p>
          </div>
        ) : (
          <>
            <ul className="divide-y divide-border rounded-xl border border-border bg-surface">
              {data.events.map((e) => (
                <Item key={e.id} e={e} email={data.email} />
              ))}
            </ul>
            <p className="mt-3 text-xs text-muted">
              Showing your latest {data.events.length} notifications.
            </p>
          </>
        )}
      </section>
    </div>
  );
}
