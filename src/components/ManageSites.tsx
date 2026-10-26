"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import AddMonitor from "@/components/AddMonitor";
import BulkBar from "@/components/BulkBar";
import ImportSites from "@/components/ImportSites";
import { type Monitor, sitePath, useAutoClear, useMonitors } from "@/components/monitor-ui";
import { type Brief, Dot, TONE_TEXT, aiBrief, domainBrief, intervalText, siteTone, sslBrief, uptimeBrief } from "@/components/site-health";

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
function SiteRow({ m, showAi, columns, onRemoved, selectable, selected, onSelect }: { m: Monitor; showAi: boolean; columns: string; onRemoved: (m: Monitor) => void; selectable: boolean; selected: boolean; onSelect: (on: boolean) => void }) {
  const site = m.kind === "site";
  const [confirming, setConfirming] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function remove() {
    setBusy(true);
    setError(null);
    try {
      const res = await fetch(`/api/monitors/${m.id}`, { method: "DELETE" });
      if (res.ok) {
        onRemoved(m);
        return;
      }
      setError((await res.json().catch(() => ({}))).error ?? "Couldn't remove it.");
    } catch {
      setError("Couldn't reach the server. Try again.");
    }
    setBusy(false);
  }

  // Only a whole site has SSL, domain and AI checks; the other kinds show a dash there (and nothing on a phone).
  const checks: [string, Brief][] = [
    [m.kind === "heartbeat" ? "Check-ins" : "Uptime", uptimeBrief(m)],
    ["SSL", site ? sslBrief(m) : NONE],
    ["Domain", site ? domainBrief(m) : NONE],
  ];
  if (showAi) checks.push(["AI search", site && m.ai ? aiBrief(m.ai) : NONE]);
  const line = kindLine(m);

  if (confirming) {
    return (
      <li className="px-4 py-3.5 sm:px-5" onKeyDown={(e) => e.key === "Escape" && !busy && setConfirming(false)}>
        <p className="text-sm">
          Stop monitoring <span className="break-all font-medium">{m.host}</span>? Its history goes too.
        </p>
        <div className="mt-2.5 flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={remove}
            disabled={busy}
            autoFocus
            className="rounded-lg bg-bad px-3 py-1.5 text-sm font-medium text-background disabled:opacity-50"
          >
            {busy ? "Removing…" : "Yes, remove"}
          </button>
          <button type="button" onClick={() => setConfirming(false)} disabled={busy} className="rounded-lg border border-border px-3 py-1.5 text-sm hover:bg-border/40 disabled:opacity-50">
            Cancel
          </button>
        </div>
        {error && (
          <p role="alert" className="mt-2 text-sm text-bad">
            {error}
          </p>
        )}
      </li>
    );
  }

  return (
    <li className={`relative ${selected ? "bg-accent/5" : ""}`}>
      {selectable && (
        <input
          type="checkbox"
          checked={selected}
          onChange={(e) => onSelect(e.target.checked)}
          aria-label={`Select ${m.host}`}
          className="absolute left-4 top-[1.3rem] z-[1] h-4 w-4 accent-[var(--accent)] sm:left-5 sm:top-1/2 sm:-translate-y-1/2"
        />
      )}
      <Link href={sitePath(m.id)} className={`grid items-center gap-x-4 gap-y-2 py-3.5 pr-14 hover:bg-foreground/5 sm:[grid-template-columns:var(--cols)] ${selectable ? "pl-11 sm:pl-12 sm:pr-5" : "pl-4 sm:px-5"}`} style={{ "--cols": columns } as React.CSSProperties}>
        <span className="flex min-w-0 items-center gap-2.5">
          <Dot tone={siteTone(m)} />
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
      {/* Beside the link, not inside it: a button can't sit in a link. */}
      <button
        type="button"
        onClick={() => setConfirming(true)}
        title={`Remove ${m.host}`}
        aria-label={`Remove ${m.host}`}
        className="absolute right-2 top-2 flex h-10 w-10 items-center justify-center rounded-lg text-muted transition-colors hover:bg-bad/10 hover:text-bad sm:right-3 sm:top-1/2 sm:-translate-y-1/2"
      >
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.75} strokeLinecap="round" strokeLinejoin="round" className="h-5 w-5" aria-hidden>
          <path d="M4 7h16M10 11v6m4-6v6M6 7l1 13h10l1-13M9 7V4h6v3" />
        </svg>
      </button>
    </li>
  );
}

// ---------- the Sites tab ----------

export default function ManageSites() {
  const { data, loadError, reload } = useMonitors("/dashboard/sites");
  const [notice, setNotice] = useState<string | null>(null);
  useAutoClear(notice, () => setNotice(null));
  // Which client's monitors to show ("all", "none" or a client's id), and which monitors are ticked for a bulk change.
  const [filter, setFilter] = useState("all");
  const [picked, setPicked] = useState<Set<number>>(new Set());
  // What the last bulk change did. Shown in the bar itself, since the page notice is far above the list.
  const [barMessage, setBarMessage] = useState<string | null>(null);
  useAutoClear(barMessage, () => setBarMessage(null));

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
  const columns = `minmax(0,1.6fr) repeat(${showAi ? 4 : 3}, minmax(0,1fr)) 3.25rem`;

  // Clients (Agency): a filter, and the list grouped under each client's name.
  const clients = data.clients;
  const byClient = data.plan.clients && clients.length > 0;
  const bulk = data.plan.bulkTools;
  const shown = data.monitors.filter((m) => (filter === "all" ? true : filter === "none" ? m.clientId === null : m.clientId === Number(filter)));
  const groups: { key: string; name: string | null; items: Monitor[] }[] =
    byClient && filter === "all"
      ? [...clients.map((c) => ({ key: String(c.id), name: c.name, items: shown.filter((m) => m.clientId === c.id) })), { key: "none", name: "No client", items: shown.filter((m) => m.clientId === null) }].filter((g) => g.items.length > 0)
      : [{ key: "all", name: null, items: shown }];
  const liveIds = new Set(data.monitors.map((m) => m.id));
  const chosen = [...picked].filter((id) => liveIds.has(id));
  const toggle = (ids: number[], on: boolean) =>
    setPicked((prev) => {
      const next = new Set(prev);
      for (const id of ids) {
        if (on) next.add(id);
        else next.delete(id);
      }
      return next;
    });
  const allShownPicked = shown.length > 0 && shown.every((m) => picked.has(m.id));

  return (
    <div>
      <h1 className="text-3xl font-semibold tracking-tight">Sites</h1>
      <p className="mt-2 text-muted">Everything we watch for you: whole sites, single pages, ports and scheduled jobs. Open one to see its checks, share its status page, or change it.</p>

      <AddMonitor
        count={data.monitors.length}
        limit={data.limit}
        planName={data.plan.name}
        kinds={data.plan.monitorKinds}
        clients={data.plan.clients ? clients : []}
        onAdded={async (message) => {
          setNotice(message);
          await reload();
        }}
      />
      {bulk && (
        <ImportSites
          clients={clients}
          onDone={async (message) => {
            setNotice(message);
            await reload();
          }}
        />
      )}

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
          <>
            {byClient && (
              <div className="mt-3 flex items-center gap-2">
                <label htmlFor="client-filter" className="text-sm text-muted">
                  Show
                </label>
                <select
                  id="client-filter"
                  value={filter}
                  onChange={(e) => setFilter(e.target.value)}
                  className="rounded-lg border border-border bg-background px-2.5 py-1.5 text-sm outline-none focus:border-accent focus:ring-2 focus:ring-accent/30"
                >
                  <option value="all">All clients</option>
                  {clients.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.name}
                    </option>
                  ))}
                  <option value="none">No client</option>
                </select>
              </div>
            )}
            <div className="mt-3 overflow-hidden rounded-xl border border-border bg-surface">
              {chosen.length > 0 ? (
                <BulkBar ids={chosen} clients={clients} alertRouting message={barMessage} onClear={() => setPicked(new Set())} onDone={async (message) => (setBarMessage(message), reload())} />
              ) : (
                barMessage && (
                  <p role="status" className="sticky top-0 z-10 flex items-center gap-2 border-b border-border bg-ok-bg px-4 py-3 text-sm font-medium text-ok sm:px-5">
                    <span aria-hidden>✓</span>
                    {barMessage}
                  </p>
                )
              )}
              <div aria-hidden className={`hidden gap-x-4 border-b border-border py-2.5 text-xs font-medium text-muted sm:grid ${bulk ? "pl-12 pr-5" : "px-5"}`} style={{ gridTemplateColumns: columns }}>
                <span>Monitor</span>
                <span>Uptime</span>
                <span>SSL</span>
                <span>Domain</span>
                {showAi && <span>AI search</span>}
                <span />
              </div>
              {bulk && shown.length > 0 && (
                <div className="flex items-center gap-2.5 border-b border-border px-4 py-2 text-xs text-muted sm:px-5">
                  <input
                    id="select-all"
                    type="checkbox"
                    checked={allShownPicked}
                    onChange={(e) => toggle(shown.map((m) => m.id), e.target.checked)}
                    className="h-4 w-4 accent-[var(--accent)]"
                  />
                  <label htmlFor="select-all">Select all {shown.length}</label>
                </div>
              )}
              {shown.length === 0 && <p className="px-5 py-6 text-center text-sm text-muted">No monitors under this client yet.</p>}
              {groups.map((g) => (
                <div key={g.key}>
                  {g.name !== null && (
                    <div className="flex items-center gap-2.5 border-b border-t border-border bg-foreground/5 px-4 py-2 text-sm font-medium first:border-t-0 sm:px-5">
                      {bulk && (
                        <input
                          type="checkbox"
                          checked={g.items.every((m) => picked.has(m.id))}
                          onChange={(e) => toggle(g.items.map((m) => m.id), e.target.checked)}
                          aria-label={`Select all of ${g.name}`}
                          className="h-4 w-4 accent-[var(--accent)]"
                        />
                      )}
                      {g.name}
                      <span className="text-xs font-normal text-muted">{g.items.length}</span>
                    </div>
                  )}
                  <ul className="divide-y divide-border">
                    {g.items.map((m) => (
                      <SiteRow
                        key={m.id}
                        m={m}
                        showAi={showAi}
                        columns={columns}
                        selectable={bulk}
                        selected={picked.has(m.id)}
                        onSelect={(on) => toggle([m.id], on)}
                        onRemoved={async (gone) => {
                          setNotice(`Removed ${gone.host}.`);
                          await reload();
                        }}
                      />
                    ))}
                  </ul>
                </div>
              ))}
            </div>
          </>
        )}
      </section>
    </div>
  );
}
