"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import AddMonitor from "@/components/AddMonitor";
import { type Monitor, sitePath, useMonitors } from "@/components/monitor-ui";
import { type Brief, Dot, TONE_TEXT, aiBrief, domainBrief, intervalText, sslBrief, uptimeBrief } from "@/components/site-health";

const OVERALL_TONE = { ok: "ok", warning: "warn", problem: "bad", down: "bad", pending: "muted" } as const;

const NONE: Brief = { tone: "muted", text: "—" };

/** A line under a monitor's name saying what it is, for anything that isn't a whole site. */
function kindLine(m: Monitor): string | null {
  const t = m.target;
  if (m.kind === "http") return t.keyword ? `Page · must ${t.keywordMode === "absent" ? "not contain" : "contain"} \u201c${t.keyword}\u201d` : "Page";
  if (m.kind === "tcp") return "Port";
  if (m.kind === "heartbeat") return `Heartbeat · every ${intervalText(t.heartbeat?.everyMs ?? null)}`;
  return null;
}

/** One monitor in the list: the whole row opens its own page. */
function SiteRow({ m, showAi, columns }: { m: Monitor; showAi: boolean; columns: string }) {
  const site = m.kind === "site";
  // Only a whole site has SSL, domain and AI checks; the other kinds show a dash there (and nothing on a phone).
  const checks: [string, Brief][] = [
    [m.kind === "heartbeat" ? "Check-ins" : "Uptime", uptimeBrief(m)],
    ["SSL", site ? sslBrief(m) : NONE],
    ["Domain", site ? domainBrief(m) : NONE],
  ];
  if (showAi) checks.push(["AI search", site && m.ai ? aiBrief(m.ai) : NONE]);
  const line = kindLine(m);
  return (
    <li>
      <Link href={sitePath(m.id)} className="grid items-center gap-x-4 gap-y-2 px-4 py-3.5 hover:bg-foreground/5 sm:px-5 sm:[grid-template-columns:var(--cols)]" style={{ "--cols": columns } as React.CSSProperties}>
        <span className="flex min-w-0 items-center gap-2.5">
          <Dot tone={OVERALL_TONE[m.overall]} />
          <span className="min-w-0">
            <span className="block truncate font-medium" title={m.host}>
              {m.host}
            </span>
            {line && <span className="block truncate text-xs text-muted">{line}</span>}
          </span>
        </span>
        {/* On a phone the checks wrap underneath, each with its name; on wider screens the column headings name them. */}
        <span className="flex flex-wrap gap-x-4 gap-y-1 pl-[18px] text-sm sm:contents sm:pl-0">
          {checks.map(([label, b]) => (
            <span key={label} className={`whitespace-nowrap ${TONE_TEXT[b.tone]} ${b === NONE ? "hidden sm:inline" : ""}`}>
              <span className="text-muted sm:sr-only">{label} </span>
              {b.text}
            </span>
          ))}
        </span>
        <span aria-hidden className="hidden text-muted sm:block">
          ›
        </span>
      </Link>
    </li>
  );
}

// ---------- the Sites tab ----------

export default function ManageSites() {
  const { data, loadError, reload } = useMonitors("/dashboard/sites");
  const [notice, setNotice] = useState<string | null>(null);

  // "Add a site" elsewhere in the app links here as /dashboard/sites#add: put the cursor in the box.
  const loaded = !!data;
  useEffect(() => {
    if (loaded && window.location.hash === "#add") document.getElementById("new-host")?.focus();
  }, [loaded]);

  if (!data) {
    return loadError ? (
      <p role="alert" className="rounded-lg bg-bad-bg px-4 py-3 text-sm text-bad">
        {loadError}
      </p>
    ) : (
      <p className="text-muted">Loading your sites…</p>
    );
  }

  const showAi = data.plan.aiVisibility;
  const columns = `minmax(0,1.6fr) repeat(${showAi ? 4 : 3}, minmax(0,1fr)) 1rem`;

  return (
    <div>
      <h1 className="text-3xl font-semibold tracking-tight">Sites</h1>
      <p className="mt-2 text-muted">Everything we watch for you: whole sites, single pages, ports and scheduled jobs. Open one to see its checks, share its status page, or change it.</p>

      <AddMonitor
        count={data.monitors.length}
        limit={data.limit}
        planName={data.plan.name}
        kinds={data.plan.monitorKinds}
        onAdded={async (message) => {
          setNotice(message);
          await reload();
        }}
      />

      {notice && (
        <p role="status" className="mt-4 rounded-lg bg-ok-bg px-4 py-3 text-sm text-ok">
          {notice}
        </p>
      )}
      {loadError && (
        <p role="alert" className="mt-4 rounded-lg bg-warn-bg px-4 py-3 text-sm text-warn">
          {loadError}
        </p>
      )}

      <section className="mt-8" aria-labelledby="your-sites">
        <h2 id="your-sites" className="font-semibold">
          Your monitors
        </h2>
        {data.monitors.length === 0 ? (
          <div className="mt-3 rounded-xl border border-dashed border-border p-8 text-center">
            <p className="font-medium">You aren&apos;t watching any sites yet</p>
            <p className="mt-1 text-sm text-muted">Add a domain above and we&apos;ll start checking it straight away.</p>
          </div>
        ) : (
          <div className="mt-3 overflow-hidden rounded-xl border border-border bg-surface">
            <div aria-hidden className="hidden gap-x-4 border-b border-border px-5 py-2.5 text-xs font-medium text-muted sm:grid" style={{ gridTemplateColumns: columns }}>
              <span>Monitor</span>
              <span>Uptime</span>
              <span>SSL</span>
              <span>Domain</span>
              {showAi && <span>AI search</span>}
              <span />
            </div>
            <ul className="divide-y divide-border">
              {data.monitors.map((m) => (
                <SiteRow key={m.id} m={m} showAi={showAi} columns={columns} />
              ))}
            </ul>
          </div>
        )}
      </section>
    </div>
  );
}
