"use client";

import Link from "next/link";
import { useEffect, useState } from "react";

interface Key {
  id: number;
  name: string;
  prefix: string;
  createdAt: number;
  lastUsedAt: number | null;
}

const SMALL = "rounded-lg border border-border px-3 py-1.5 text-sm hover:border-accent hover:text-accent disabled:opacity-50";
const day = (ms: number) => new Date(ms).toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" });

/** The "API & export" page: download the account's data (every plan), and API keys (Pro). */
export default function ApiAndExport() {
  const [data, setData] = useState<{ allowed: boolean; max: number; keys: Key[] } | null>(null);
  const [name, setName] = useState("");
  const [fresh, setFresh] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [origin] = useState(() => (typeof window === "undefined" ? "" : window.location.origin));

  const load = async () => {
    const r = await fetch("/api/keys", { cache: "no-store" });
    if (r.ok) setData(await r.json());
  };
  useEffect(() => {
    let cancelled = false;
    fetch("/api/keys", { cache: "no-store" })
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => d && !cancelled && setData(d))
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, []);

  async function create(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      const res = await fetch("/api/keys", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ name }) });
      const body = await res.json();
      if (!res.ok) setError(body.error ?? "Something went wrong.");
      else {
        setFresh(body.key);
        setName("");
        await load();
      }
    } catch {
      setError("Couldn't reach the server. Try again.");
    }
    setBusy(false);
  }

  async function remove(k: Key) {
    setBusy(true);
    setError(null);
    const res = await fetch(`/api/keys/${k.id}`, { method: "DELETE" }).catch(() => null);
    if (!res?.ok) setError("Couldn't delete it. Try again.");
    await load();
    setBusy(false);
  }

  return (
    <div>
      <h1 className="text-3xl font-semibold tracking-tight">API &amp; export</h1>
      <p className="mt-2 text-muted">Take your data with you, or read it from your own tools.</p>

      <section className="mt-6 rounded-xl border border-border bg-surface p-5" aria-labelledby="export-heading">
        <h2 id="export-heading" className="font-semibold">
          Download your data
        </h2>
        <p className="mt-0.5 text-sm text-muted">CSV opens in any spreadsheet. Daily uptime goes as far back as your plan shows.</p>
        <ul className="mt-3 divide-y divide-border text-sm">
          {[
            ["monitors", "Monitors", "Every monitor and its current state"],
            ["uptime", "Daily uptime", "One row per monitor per day"],
            ["events", "Notifications", "Alerts and notices, newest first"],
          ].map(([what, label, hint]) => (
            <li key={what} className="flex flex-wrap items-center justify-between gap-3 py-2.5">
              <span>
                <span className="font-medium">{label}</span>
                <span className="block text-xs text-muted">{hint}</span>
              </span>
              <span className="flex gap-2">
                <a href={`/api/export?what=${what}&format=csv`} className={SMALL} download>
                  CSV
                </a>
                <a href={`/api/export?what=${what}&format=json`} className={SMALL} download>
                  JSON
                </a>
              </span>
            </li>
          ))}
        </ul>
      </section>

      <section className="mt-4 rounded-xl border border-border bg-surface p-5" aria-labelledby="api-heading">
        <h2 id="api-heading" className="flex flex-wrap items-center gap-2 font-semibold">
          API keys
          {data && !data.allowed && <span className="rounded-full border border-border px-2 py-0.5 text-xs font-medium text-muted">Pro</span>}
        </h2>
        <p className="mt-0.5 text-sm text-muted">Read your monitors, their history and your notifications from scripts and dashboards. Keys can read, not change anything.</p>

        {!data ? (
          <p className="mt-3 text-sm text-muted">Loading…</p>
        ) : !data.allowed ? (
          <p className="mt-3 text-sm text-muted">
            The API is part of the Pro plan.{" "}
            <Link href="/dashboard/plans" className="text-accent underline underline-offset-2">
              See the plans
            </Link>
            .
          </p>
        ) : (
          <>
            {fresh && (
              <div role="status" className="mt-3 rounded-lg border border-ok/40 bg-ok-bg p-3 text-sm">
                <p className="font-medium text-ok">Here&apos;s your new key. Copy it now: it won&apos;t be shown again.</p>
                <div className="mt-2 flex gap-2">
                  <input readOnly value={fresh} aria-label="New API key" onFocus={(e) => e.currentTarget.select()} className="min-w-0 flex-1 rounded-md border border-border bg-surface px-2.5 py-1.5 font-mono text-xs" />
                  <button
                    type="button"
                    className={SMALL}
                    onClick={async () => {
                      await navigator.clipboard.writeText(fresh).catch(() => {});
                      setCopied(true);
                    }}
                  >
                    {copied ? "Copied" : "Copy"}
                  </button>
                </div>
              </div>
            )}
            {data.keys.length > 0 && (
              <ul className="mt-3 divide-y divide-border border-t border-border text-sm">
                {data.keys.map((k) => (
                  <li key={k.id} className="flex flex-wrap items-center justify-between gap-3 py-2.5">
                    <span className="min-w-0">
                      <span className="font-medium">{k.name}</span> <span className="font-mono text-xs text-muted">{k.prefix}…</span>
                      <span className="block text-xs text-muted">
                        Made {day(k.createdAt)} · {k.lastUsedAt ? `last used ${day(k.lastUsedAt)}` : "not used yet"}
                      </span>
                    </span>
                    <button type="button" className={SMALL} disabled={busy} onClick={() => remove(k)}>
                      Delete
                    </button>
                  </li>
                ))}
              </ul>
            )}
            {data.keys.length < data.max && (
              <form onSubmit={create} className="mt-3 flex flex-col gap-2 sm:flex-row">
                <label htmlFor="key-name" className="sr-only">
                  Key name
                </label>
                <input
                  id="key-name"
                  maxLength={60}
                  placeholder="What it's for, like Grafana"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  disabled={busy}
                  className="min-w-0 flex-1 rounded-lg border border-border bg-background px-3 py-2 text-sm outline-none focus:border-accent focus:ring-2 focus:ring-accent/30"
                />
                <button type="submit" disabled={busy} className="rounded-lg bg-accent px-4 py-2 text-sm font-medium text-accent-foreground hover:opacity-90 disabled:opacity-50">
                  Make a key
                </button>
              </form>
            )}
            <details className="mt-4 text-sm">
              <summary className="cursor-pointer text-accent underline underline-offset-2">How to use it</summary>
              <div className="mt-2 space-y-2 text-muted">
                <p>Send the key in the Authorization header. Up to 120 requests a minute.</p>
                <pre className="overflow-x-auto rounded-lg border border-border bg-background p-3 font-mono text-xs text-foreground">
                  {`curl -H "Authorization: Bearer sm_..." ${origin}/api/v1/monitors
curl -H "Authorization: Bearer sm_..." "${origin}/api/v1/monitors/12?days=365"
curl -H "Authorization: Bearer sm_..." "${origin}/api/v1/events?limit=50"`}
                </pre>
                <p>Monitors come with their current state; one monitor also comes with daily uptime for up to 365 days.</p>
              </div>
            </details>
          </>
        )}
        {error && (
          <p role="alert" className="mt-2 text-sm text-bad">
            {error}
          </p>
        )}
      </section>
    </div>
  );
}
