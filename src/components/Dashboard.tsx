"use client";

import Link from "next/link";
import { KINDS } from "@/components/Notifications";
import { type Monitor, ago, sitePath, useMonitors } from "@/components/monitor-ui";
import { Dot, TONE_TEXT, attentionReasons } from "@/components/site-health";

const ADD_BUTTON = "inline-flex items-center gap-1.5 rounded-lg bg-accent px-4 py-2 text-sm font-medium text-accent-foreground hover:opacity-90";

function Tile({ label, value, tone }: { label: string; value: string | number; tone?: "ok" | "warn" | "bad" }) {
  const color = tone ? { ok: "text-ok", warn: "text-warn", bad: "text-bad" }[tone] : "";
  return (
    <div className="rounded-xl border border-border bg-surface px-4 py-3.5">
      <dd className={`text-2xl font-semibold tracking-tight ${color}`}>{value}</dd>
      <dt className="mt-0.5 text-xs text-muted">{label}</dt>
    </div>
  );
}

/** One site that needs a look: its name (to its page) and each reason, most serious first. */
function AttentionItem({ m }: { m: Monitor }) {
  const reasons = attentionReasons(m);
  return (
    <li>
      <Link href={sitePath(m.id)} className="flex items-start justify-between gap-3 px-4 py-3.5 hover:bg-foreground/5 sm:px-5">
        <div className="min-w-0">
          <p className="break-all font-medium">{m.host}</p>
          <ul className="mt-1 space-y-0.5 text-sm">
            {reasons.map((r) => (
              <li key={r.text} className={`flex items-center gap-2 ${TONE_TEXT[r.tone]}`}>
                <Dot tone={r.tone} />
                <span className="min-w-0 break-words">{r.text}</span>
              </li>
            ))}
          </ul>
        </div>
        <span aria-hidden className="mt-0.5 text-muted">
          ›
        </span>
      </Link>
    </li>
  );
}

// ---------- the Overview tab: how everything is, at a glance ----------

export default function Dashboard() {
  const { data, loadError } = useMonitors("/dashboard");

  if (!data) {
    return loadError ? (
      <p role="alert" className="rounded-lg bg-bad-bg px-4 py-3 text-sm text-bad">
        {loadError}
      </p>
    ) : (
      <p className="text-muted">Loading your dashboard…</p>
    );
  }

  const sites = data.monitors;
  const down = sites.filter((m) => m.overall === "down").length;
  const attention = sites.filter((m) => attentionReasons(m).length > 0);
  // Down first, then other problems, then things expiring soon.
  const rank = (m: Monitor) => (m.overall === "down" ? 0 : attentionReasons(m)[0]?.tone === "bad" ? 1 : 2);
  attention.sort((a, b) => rank(a) - rank(b));
  const hostId = new Map(sites.map((m) => [m.host, m.id]));
  const recent = data.events.slice(0, 5);

  return (
    <div>
      <div className="flex flex-wrap items-end justify-between gap-3">
        <h1 className="text-3xl font-semibold tracking-tight">Overview</h1>
        {sites.length > 0 && (
          <Link href="/dashboard/sites#add" className={ADD_BUTTON}>
            <span aria-hidden>+</span> Add a site
          </Link>
        )}
      </div>

      {loadError && (
        <p role="alert" className="mt-4 rounded-lg bg-warn-bg px-4 py-3 text-sm text-warn">
          {loadError}
        </p>
      )}

      {sites.length === 0 ? (
        <div className="mt-6 rounded-xl border border-dashed border-border p-8 text-center">
          <p className="font-medium">You aren&apos;t watching any sites yet</p>
          <p className="mt-1 text-sm text-muted">Add a domain and we&apos;ll check its uptime, SSL certificate and domain expiry around the clock.</p>
          <Link href="/dashboard/sites#add" className="mt-4 inline-block rounded-lg bg-accent px-5 py-2.5 text-sm font-medium text-accent-foreground hover:opacity-90">
            Add your first site
          </Link>
        </div>
      ) : (
        <>
          <dl className="mt-6 grid grid-cols-2 gap-3 sm:grid-cols-4">
            <Tile label={`Sites watched, of ${data.limit}`} value={sites.length} />
            <Tile label="All good" value={sites.filter((m) => m.overall === "ok" && attentionReasons(m).length === 0).length} tone="ok" />
            <Tile label="Need a look" value={attention.length - down} tone={attention.length - down ? "warn" : undefined} />
            <Tile label="Down" value={down} tone={down ? "bad" : undefined} />
          </dl>

          <section className="mt-8" aria-labelledby="attention-heading">
            <div className="flex flex-wrap items-baseline justify-between gap-2">
              <h2 id="attention-heading" className="font-semibold">
                Needs attention
              </h2>
              <Link href="/dashboard/sites" className="text-sm text-accent underline underline-offset-2">
                All sites
              </Link>
            </div>
            {attention.length === 0 ? (
              <p className="mt-3 flex items-center gap-2.5 rounded-xl bg-ok-bg px-5 py-4 text-sm font-medium text-ok">
                <Dot tone="ok" />
                Everything is running normally.
              </p>
            ) : (
              <ul className="mt-3 divide-y divide-border rounded-xl border border-border bg-surface">
                {attention.map((m) => (
                  <AttentionItem key={m.id} m={m} />
                ))}
              </ul>
            )}
          </section>
        </>
      )}

      <section className="mt-8" aria-labelledby="recent-heading">
        <div className="flex flex-wrap items-baseline justify-between gap-2">
          <h2 id="recent-heading" className="font-semibold">
            Recent activity
          </h2>
          {recent.length > 0 && (
            <Link href="/dashboard/notifications" className="text-sm text-accent underline underline-offset-2">
              All notifications
            </Link>
          )}
        </div>
        {recent.length === 0 ? (
          <p className="mt-3 rounded-xl border border-dashed border-border px-5 py-4 text-sm text-muted">Alerts and updates about your sites will show up here.</p>
        ) : (
          <ul className="mt-3 divide-y divide-border rounded-xl border border-border bg-surface text-sm">
            {recent.map((e) => {
              const kind = KINDS[e.kind];
              const id = hostId.get(e.host);
              return (
                <li key={e.id} className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1 px-4 py-3 sm:px-5">
                  <div className="min-w-0">
                    {kind && <span className={`mr-2 inline-block rounded-full px-2 py-0.5 text-xs font-medium ${kind.tone}`}>{kind.label}</span>}
                    {id ? (
                      <Link href={sitePath(id)} className="break-all font-medium hover:text-accent">
                        {e.host}
                      </Link>
                    ) : (
                      <span className="break-all font-medium">{e.host}</span>
                    )}
                  </div>
                  <span className="shrink-0 text-xs text-muted">{ago(e.at)}</span>
                </li>
              );
            })}
          </ul>
        )}
      </section>

      <p className="mt-8 text-sm text-muted">
        We check every site around the clock and email you when something needs attention. Choose where alerts go on the{" "}
        <Link href="/dashboard/integrations" className="text-accent underline underline-offset-2">
          Integrations
        </Link>{" "}
        page.
      </p>
    </div>
  );
}
