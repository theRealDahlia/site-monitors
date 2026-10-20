"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { type Monitor, sitePath, useMonitors } from "@/components/monitor-ui";
import { type Brief, Dot, TONE_TEXT, aiBrief, domainBrief, sslBrief, uptimeBrief } from "@/components/site-health";

const INPUT =
  "min-w-0 flex-1 rounded-lg border border-border bg-surface px-4 py-3 text-base outline-none placeholder:text-muted/70 focus:border-accent focus:ring-2 focus:ring-accent/30 disabled:opacity-60";

const OVERALL_TONE = { ok: "ok", warning: "warn", problem: "bad", down: "bad", pending: "muted" } as const;

/** One site in the list: the whole row opens the site's own page. */
function SiteRow({ m, showAi, columns }: { m: Monitor; showAi: boolean; columns: string }) {
  const checks: [string, Brief][] = [
    ["Uptime", uptimeBrief(m)],
    ["SSL", sslBrief(m)],
    ["Domain", domainBrief(m)],
  ];
  if (showAi && m.ai) checks.push(["AI search", aiBrief(m.ai)]);
  return (
    <li>
      <Link href={sitePath(m.id)} className="grid items-center gap-x-4 gap-y-2 px-4 py-3.5 hover:bg-foreground/5 sm:px-5 sm:[grid-template-columns:var(--cols)]" style={{ "--cols": columns } as React.CSSProperties}>
        <span className="flex min-w-0 items-center gap-2.5">
          <Dot tone={OVERALL_TONE[m.overall]} />
          <span className="break-all font-medium">{m.host}</span>
        </span>
        {/* On a phone the checks wrap underneath, each with its name; on wider screens the column headings name them. */}
        <span className="flex flex-wrap gap-x-4 gap-y-1 pl-[18px] text-sm sm:contents sm:pl-0">
          {checks.map(([label, b]) => (
            <span key={label} className={`whitespace-nowrap ${TONE_TEXT[b.tone]}`}>
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
  const [host, setHost] = useState("");
  const [adding, setAdding] = useState(false);
  const [addError, setAddError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const addInput = useRef<HTMLInputElement>(null);

  // "Add a site" elsewhere in the app links here as /dashboard/sites#add: put the cursor in the box.
  const loaded = !!data;
  useEffect(() => {
    if (loaded && window.location.hash === "#add") addInput.current?.focus();
  }, [loaded]);

  async function addSite(e: React.FormEvent) {
    e.preventDefault();
    if (!host.trim() || adding) return;
    setAdding(true);
    setAddError(null);
    setNotice(null);
    try {
      const res = await fetch("/api/monitors", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ host }),
      });
      const body = await res.json();
      if (!res.ok) {
        setAddError(body.error ?? "Something went wrong.");
      } else {
        setNotice(`Now watching ${body.monitor.host}. We've emailed you a confirmation and started the checks.`);
        setHost("");
        await reload();
      }
    } catch {
      setAddError("Couldn't reach the server. Try again.");
    }
    setAdding(false);
  }

  if (!data) {
    return loadError ? (
      <p role="alert" className="rounded-lg bg-bad-bg px-4 py-3 text-sm text-bad">
        {loadError}
      </p>
    ) : (
      <p className="text-muted">Loading your sites…</p>
    );
  }

  const full = data.monitors.length >= data.limit;
  const showAi = data.plan.aiVisibility;
  const columns = `minmax(0,1.6fr) repeat(${showAi ? 4 : 3}, minmax(0,1fr)) 1rem`;

  return (
    <div>
      <h1 className="text-3xl font-semibold tracking-tight">Sites</h1>
      <p className="mt-2 text-muted">Every site we watch for you. Open one to see its checks, share its status page, or change it.</p>

      <section id="add" className="mt-6 scroll-mt-6 rounded-xl border border-border bg-surface p-5" aria-labelledby="add-heading">
        <div className="flex flex-wrap items-baseline justify-between gap-2">
          <h2 id="add-heading" className="font-semibold">
            Add a site
          </h2>
          <p className="text-sm text-muted">
            {data.monitors.length} of {data.limit} sites · {data.plan.name} plan
          </p>
        </div>
        <form onSubmit={addSite} className="mt-3 flex flex-col gap-3 sm:flex-row">
          <label htmlFor="new-site" className="sr-only">
            Domain name
          </label>
          <input
            ref={addInput}
            id="new-site"
            type="text"
            inputMode="url"
            autoCapitalize="none"
            autoCorrect="off"
            spellCheck={false}
            placeholder="example.com"
            value={host}
            disabled={full || adding}
            onChange={(e) => setHost(e.target.value)}
            className={INPUT}
          />
          <button
            type="submit"
            disabled={full || adding || !host.trim()}
            className="rounded-lg bg-accent px-6 py-3 text-base font-medium text-accent-foreground transition-opacity hover:opacity-90 disabled:opacity-50"
          >
            {adding ? "Setting up…" : "Add site"}
          </button>
        </form>
        <p className="mt-2 text-xs text-muted">
          We set up uptime, SSL certificate and domain expiry checks automatically, and email you a confirmation.
          {full && (
            <>
              {" "}
              You&apos;ve reached your plan&apos;s limit. Remove a site, or{" "}
              <Link href="/dashboard/plans" className="text-accent underline underline-offset-2">
                see the plans
              </Link>
              .
            </>
          )}
        </p>
        {addError && (
          <p role="alert" className="mt-3 rounded-lg bg-bad-bg px-4 py-3 text-sm text-bad">
            {addError}
          </p>
        )}
      </section>

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
          Your sites
        </h2>
        {data.monitors.length === 0 ? (
          <div className="mt-3 rounded-xl border border-dashed border-border p-8 text-center">
            <p className="font-medium">You aren&apos;t watching any sites yet</p>
            <p className="mt-1 text-sm text-muted">Add a domain above and we&apos;ll start checking it straight away.</p>
          </div>
        ) : (
          <div className="mt-3 overflow-hidden rounded-xl border border-border bg-surface">
            <div aria-hidden className="hidden gap-x-4 border-b border-border px-5 py-2.5 text-xs font-medium text-muted sm:grid" style={{ gridTemplateColumns: columns }}>
              <span>Site</span>
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
