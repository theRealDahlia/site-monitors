"use client";

import Link from "next/link";
import { useEffect, useState } from "react";

interface Report {
  id: number;
  name: string;
  monitorIds: number[];
  slaTarget: number;
  enabled: boolean;
  lastSentMonth: string | null;
  recipients: { id: number; email: string; confirmed: boolean }[];
  preview: string;
}
interface Data {
  allowed: boolean;
  month: string;
  monitors: { id: number; host: string; kind: string }[];
  reports: Report[];
}

const FIELD = "w-full min-w-0 rounded-lg border border-border bg-background px-3 py-2 text-sm outline-none placeholder:text-muted/70 focus:border-accent focus:ring-2 focus:ring-accent/30 disabled:opacity-60";
const SMALL = "rounded-lg border border-border px-3 py-1.5 text-sm hover:border-accent hover:text-accent disabled:opacity-50";
const PRIMARY = "rounded-lg bg-accent px-4 py-2 text-sm font-medium text-accent-foreground hover:opacity-90 disabled:opacity-50";

/** What someone typed as an uptime target ("99.9" or "99.9%") as a number, or null if it isn't one between 1 and 100. */
function parseTarget(text: string): number | null {
  const t = text.trim().replace(/%$/, "").trim();
  if (!/^\d{1,3}(\.\d+)?$/.test(t)) return null;
  const n = Number(t);
  return n >= 1 && n <= 100 ? n : null;
}

async function call(url: string, method: string, body?: unknown): Promise<{ ok: boolean; data: Record<string, unknown> }> {
  try {
    const res = await fetch(url, { method, headers: body ? { "Content-Type": "application/json" } : undefined, body: body ? JSON.stringify(body) : undefined });
    return { ok: res.ok, data: await res.json() };
  } catch {
    return { ok: false, data: { error: "Couldn't reach the server. Try again." } };
  }
}

/** Name, monitors and target: used to create a report and to change one. */
function ReportForm({ monitors, initial, onSave, onCancel, busy }: { monitors: Data["monitors"]; initial?: Report; onSave: (body: Record<string, unknown>) => void; onCancel?: () => void; busy: boolean }) {
  const [name, setName] = useState(initial?.name ?? "");
  const [chosen, setChosen] = useState<Set<number>>(new Set(initial?.monitorIds ?? []));
  const [target, setTarget] = useState(String(initial?.slaTarget ?? 99.9));
  const [targetTouched, setTargetTouched] = useState(false);
  const targetValue = parseTarget(target);
  const targetBad = targetTouched && targetValue === null;
  const pre = initial ? `r${initial.id}` : "new";
  return (
    <form
      className="space-y-3"
      onSubmit={(e) => {
        e.preventDefault();
        if (targetValue === null) return setTargetTouched(true);
        onSave({ name, monitorIds: [...chosen], slaTarget: targetValue });
      }}
    >
      <div className="grid items-start gap-3 sm:grid-cols-[1fr_10rem]">
        <div>
          <label htmlFor={`${pre}-name`} className="mb-1 block text-sm font-medium">
            Client or report name
          </label>
          <input id={`${pre}-name`} maxLength={80} value={name} onChange={(e) => setName(e.target.value)} placeholder="Northwind Traders" className={FIELD} disabled={busy} />
        </div>
        <div>
          <label htmlFor={`${pre}-target`} className="mb-1 block text-sm font-medium">
            Uptime target
          </label>
          <div className="relative">
            <input
              id={`${pre}-target`}
              inputMode="decimal"
              autoComplete="off"
              maxLength={7}
              value={target}
              onChange={(e) => setTarget(e.target.value)}
              onBlur={() => setTargetTouched(true)}
              aria-invalid={targetBad}
              aria-describedby={`${pre}-target-hint`}
              className={`${FIELD} pr-8 ${targetBad ? "border-bad focus:border-bad focus:ring-bad/30" : ""}`}
              disabled={busy}
            />
            <span aria-hidden className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-sm text-muted">
              %
            </span>
          </div>
          <p id={`${pre}-target-hint`} className={`mt-1 text-xs ${targetBad ? "text-bad" : "text-muted"}`}>
            {targetBad ? "Enter a number from 1 to 100." : "From 1 to 100, like 99.9"}
          </p>
        </div>
      </div>
      <fieldset>
        <legend className="mb-1 text-sm font-medium">Monitors in the report</legend>
        {monitors.length === 0 ? (
          <p className="text-sm text-muted">Add some monitors first.</p>
        ) : (
          <ul className="grid gap-1 sm:grid-cols-2">
            {monitors.map((m) => (
              <li key={m.id} className="flex items-center gap-2 text-sm">
                <input
                  id={`${pre}-m${m.id}`}
                  type="checkbox"
                  checked={chosen.has(m.id)}
                  disabled={busy}
                  onChange={(e) => {
                    const next = new Set(chosen);
                    if (e.target.checked) next.add(m.id);
                    else next.delete(m.id);
                    setChosen(next);
                  }}
                  className="accent-[var(--accent)]"
                />
                <label htmlFor={`${pre}-m${m.id}`} className="min-w-0 truncate" title={m.host}>
                  {m.host}
                </label>
              </li>
            ))}
          </ul>
        )}
      </fieldset>
      <div className="flex gap-2">
        <button type="submit" className={PRIMARY} disabled={busy || !name.trim() || chosen.size === 0 || targetValue === null}>
          {busy ? "Saving…" : initial ? "Save" : "Create report"}
        </button>
        {onCancel && (
          <button type="button" className={SMALL} onClick={onCancel} disabled={busy}>
            Cancel
          </button>
        )}
      </div>
    </form>
  );
}

function ReportCard({ r, data, reload }: { r: Report; data: Data; reload: () => Promise<void> }) {
  const [editing, setEditing] = useState(false);
  const [email, setEmail] = useState("");
  const [busy, setBusy] = useState<string | null>(null);
  const [status, setStatus] = useState<{ ok: boolean; text: string } | null>(null);
  const [confirmDelete, setConfirmDelete] = useState(false);

  async function act(what: string, url: string, method: string, body?: unknown, done?: (d: Record<string, unknown>) => string) {
    setBusy(what);
    setStatus(null);
    const res = await call(url, method, body);
    if (!res.ok) setStatus({ ok: false, text: (res.data.error as string) ?? "Something went wrong." });
    else {
      if (done) setStatus({ ok: true, text: done(res.data) });
      await reload();
    }
    setBusy(null);
    return res.ok;
  }

  const hosts = data.monitors.filter((m) => r.monitorIds.includes(m.id)).map((m) => m.host);

  return (
    <li className="rounded-xl border border-border bg-surface p-5">
      {editing ? (
        <ReportForm
          monitors={data.monitors}
          initial={r}
          busy={busy !== null}
          onCancel={() => setEditing(false)}
          onSave={async (body) => {
            if (await act("save", `/api/reports/${r.id}`, "PATCH", body)) setEditing(false);
          }}
        />
      ) : (
        <>
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div className="min-w-0">
              <h2 className="font-semibold">{r.name}</h2>
              <p className="mt-0.5 text-sm text-muted">
                {hosts.length} monitor{hosts.length === 1 ? "" : "s"} · target {r.slaTarget}% · {r.enabled ? "sent on the 1st of each month" : "paused"}
              </p>
              <p className="mt-0.5 truncate text-xs text-muted" title={hosts.join(", ")}>
                {hosts.join(", ")}
              </p>
            </div>
            <div className="flex flex-wrap gap-2">
              <a href={r.preview} target="_blank" rel="noopener noreferrer" className={SMALL}>
                View last month&apos;s
              </a>
              <button type="button" className={SMALL} disabled={busy !== null} onClick={() => act("test", `/api/reports/${r.id}/send`, "POST", undefined, (d) => `Sent last month's report to ${d.to}.`)}>
                {busy === "test" ? "Sending…" : "Email me a copy"}
              </button>
              <button type="button" className={SMALL} disabled={busy !== null} onClick={() => setEditing(true)}>
                Edit
              </button>
              <button
                type="button"
                className={SMALL}
                disabled={busy !== null}
                onClick={() => act("pause", `/api/reports/${r.id}`, "PATCH", { name: r.name, monitorIds: r.monitorIds, slaTarget: r.slaTarget, enabled: !r.enabled })}
              >
                {r.enabled ? "Pause" : "Resume"}
              </button>
              {confirmDelete ? (
                <button type="button" className="rounded-lg bg-bad px-3 py-1.5 text-sm font-medium text-background" onClick={() => act("delete", `/api/reports/${r.id}`, "DELETE")}>
                  Delete report
                </button>
              ) : (
                <button type="button" className={SMALL} disabled={busy !== null} onClick={() => setConfirmDelete(true)}>
                  Delete
                </button>
              )}
            </div>
          </div>

          <div className="mt-4 border-t border-border pt-4">
            <p className="text-sm font-medium">Who gets it</p>
            {r.recipients.length === 0 ? (
              <p className="text-xs text-muted">Nobody yet. Add your client&apos;s address: they&apos;ll get a link to confirm before the first report.</p>
            ) : (
              <ul className="mt-1 divide-y divide-border text-sm">
                {r.recipients.map((x) => (
                  <li key={x.id} className="flex items-center justify-between gap-3 py-1.5">
                    <span className="min-w-0 truncate">
                      {x.email}
                      {!x.confirmed && <span className="ml-2 text-xs text-warn">waiting for them to confirm</span>}
                    </span>
                    <button type="button" className="shrink-0 rounded-md border border-border px-2.5 py-1 text-xs hover:border-accent hover:text-accent" onClick={() => act(`rm${x.id}`, `/api/reports/${r.id}/recipients/${x.id}`, "DELETE")}>
                      Remove
                    </button>
                  </li>
                ))}
              </ul>
            )}
            {r.recipients.length < 10 && (
              <form
                className="mt-2 flex flex-col gap-2 sm:flex-row"
                onSubmit={async (e) => {
                  e.preventDefault();
                  if (await act("add", `/api/reports/${r.id}/recipients`, "POST", { email }, () => `We've emailed ${email} a link to confirm.`)) setEmail("");
                }}
              >
                <label htmlFor={`r${r.id}-email`} className="sr-only">
                  Email address
                </label>
                <input id={`r${r.id}-email`} type="email" placeholder="client@example.com" value={email} onChange={(e) => setEmail(e.target.value)} className={FIELD} disabled={busy !== null} />
                <button type="submit" className={`${SMALL} shrink-0`} disabled={busy !== null || !email.trim()}>
                  {busy === "add" ? "Sending…" : "Add"}
                </button>
              </form>
            )}
          </div>
        </>
      )}
      {status && (
        <p role={status.ok ? "status" : "alert"} className={`mt-3 text-sm ${status.ok ? "text-ok" : "text-bad"}`}>
          {status.text}
        </p>
      )}
    </li>
  );
}

/** The Reports tab (Pro): monthly uptime reports for clients. */
export default function Reports() {
  const [data, setData] = useState<Data | null>(null);
  const [creating, setCreating] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const reload = async () => {
    const r = await call("/api/reports", "GET");
    if (r.ok) setData(r.data as unknown as Data);
  };

  useEffect(() => {
    let cancelled = false;
    call("/api/reports", "GET").then((r) => r.ok && !cancelled && setData(r.data as unknown as Data));
    return () => {
      cancelled = true;
    };
  }, []);

  if (!data) return <p className="text-muted">Loading…</p>;

  return (
    <div>
      <h1 className="flex flex-wrap items-center gap-3 text-3xl font-semibold tracking-tight">
        Reports
        {!data.allowed && <span className="rounded-full border border-border px-2.5 py-0.5 text-sm font-medium text-muted">Pro</span>}
      </h1>
      <p className="mt-2 text-muted">
        A monthly uptime report for each client, with your logo and colours. It&apos;s emailed on the 1st of each month, and links to a full report they can save as a PDF.
      </p>

      {!data.allowed ? (
        <section className="mt-6 rounded-xl border border-border bg-surface p-5">
          <h2 className="font-semibold">Part of the Pro plan</h2>
          <ul className="mt-2 list-disc space-y-1 pl-5 text-sm text-muted">
            <li>Uptime for the month against a target you set, like 99.9%</li>
            <li>Every outage and how long it lasted, and average response times</li>
            <li>When certificates and domains are due for renewal</li>
            <li>Sent automatically to your clients, with your branding</li>
          </ul>
          <Link href="/dashboard/plans" className="mt-4 inline-block rounded-lg bg-accent px-4 py-2 text-sm font-medium text-accent-foreground hover:opacity-90">
            See the plans
          </Link>
        </section>
      ) : (
        <>
          {data.reports.length > 0 && (
            <ul className="mt-6 space-y-4">
              {data.reports.map((r) => (
                <ReportCard key={r.id} r={r} data={data} reload={reload} />
              ))}
            </ul>
          )}
          <section className="mt-6 rounded-xl border border-border bg-surface p-5">
            {creating || data.reports.length === 0 ? (
              <>
                <h2 className="mb-3 font-semibold">New report</h2>
                <ReportForm
                  monitors={data.monitors}
                  busy={busy}
                  onCancel={data.reports.length ? () => setCreating(false) : undefined}
                  onSave={async (body) => {
                    setBusy(true);
                    setError(null);
                    const r = await call("/api/reports", "POST", body);
                    if (!r.ok) setError((r.data.error as string) ?? "Something went wrong.");
                    else {
                      setCreating(false);
                      await reload();
                    }
                    setBusy(false);
                  }}
                />
                {error && (
                  <p role="alert" className="mt-2 text-sm text-bad">
                    {error}
                  </p>
                )}
              </>
            ) : (
              <button type="button" className={PRIMARY} onClick={() => setCreating(true)}>
                New report
              </button>
            )}
          </section>
        </>
      )}
    </div>
  );
}
