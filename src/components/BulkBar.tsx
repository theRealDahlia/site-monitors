"use client";

import { useEffect, useState } from "react";

const SELECT = "rounded-lg border border-border bg-background px-2.5 py-1.5 text-sm outline-none focus:border-accent focus:ring-2 focus:ring-accent/30 disabled:opacity-60";
const BUTTON = "rounded-lg border border-border px-3 py-1.5 text-sm hover:border-accent hover:text-accent disabled:opacity-50";
// The buttons that make a change: filled, so they stand out from the rest of the bar.
const APPLY = "rounded-lg bg-accent px-4 py-1.5 text-sm font-medium text-accent-foreground hover:opacity-90 disabled:opacity-40";

interface Target {
  id: string;
  label: string;
  kind: string;
}

/** What to do with the monitors that are ticked on the Sites page (Agency): move them to a client, set their alerts, or remove them. */
export default function BulkBar({
  ids,
  clients,
  alertRouting,
  message,
  onClear,
  onDone,
}: {
  ids: number[];
  clients: { id: number; name: string }[];
  alertRouting: boolean;
  /** What the last change did, shown in the bar until it fades. */
  message: string | null;
  onClear: () => void;
  onDone: (message: string) => Promise<void>;
}) {
  const [targets, setTargets] = useState<Target[] | null>(null);
  const [clientPick, setClientPick] = useState("");
  const [alertPick, setAlertPick] = useState("");
  const [busy, setBusy] = useState<"client" | "alerts" | "delete" | null>(null);
  const [confirming, setConfirming] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const n = ids.length;

  useEffect(() => {
    if (!alertRouting) return;
    let cancelled = false;
    fetch("/api/alert-targets", { cache: "no-store" })
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => !cancelled && d && setTargets(d.targets))
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [alertRouting]);

  async function send(kind: "client" | "alerts" | "delete", body: Record<string, unknown>, done: (changed: number) => string) {
    setBusy(kind);
    setError(null);
    try {
      const res = await fetch("/api/monitors/bulk", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ ids, ...body }) });
      const out = await res.json();
      if (!res.ok) setError(out.error ?? "Something went wrong.");
      else {
        setConfirming(false);
        setClientPick("");
        setAlertPick("");
        // Moving or re-routing keeps the monitors ticked, so you can see what changed and carry on; removed ones are gone.
        if (kind === "delete") onClear();
        await onDone(done(out.changed));
      }
    } catch {
      setError("Couldn't reach the server. Try again.");
    }
    setBusy(null);
  }

  const sites = (count: number) => `${count} monitor${count === 1 ? "" : "s"}`;

  return (
    <div role="region" aria-label="Actions for the chosen monitors" className="sticky top-0 z-10 border-b border-border bg-surface px-4 py-3 sm:px-5">
      <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
        <p className="text-sm font-medium">{n} selected</p>

        {clients.length > 0 && (
          <div className="flex items-center gap-2">
            <label htmlFor="bulk-client" className="sr-only">
              Move to client
            </label>
            <select id="bulk-client" value={clientPick} onChange={(e) => setClientPick(e.target.value)} disabled={busy !== null} className={SELECT}>
              <option value="">Move to client…</option>
              <option value="none">No client</option>
              {clients.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </select>
            <button
              type="button"
              disabled={busy !== null || !clientPick}
              onClick={() => send("client", { action: "client", clientId: clientPick === "none" ? null : Number(clientPick) }, (c) => `Moved ${sites(c)}.`)}
              className={APPLY}
            >
              {busy === "client" ? "Moving…" : "Move"}
            </button>
          </div>
        )}

        {alertRouting && targets && (
          <div className="flex items-center gap-2">
            <label htmlFor="bulk-alerts" className="sr-only">
              Send alerts to
            </label>
            <select id="bulk-alerts" value={alertPick} onChange={(e) => setAlertPick(e.target.value)} disabled={busy !== null} className={SELECT}>
              <option value="">Send alerts to…</option>
              <option value="everyone">Everyone</option>
              {targets.map((t) => (
                <option key={t.id} value={t.id}>
                  {t.label}
                </option>
              ))}
            </select>
            <button
              type="button"
              disabled={busy !== null || !alertPick}
              onClick={() => send("alerts", { action: "alerts", targets: alertPick === "everyone" ? null : [alertPick] }, (c) => `Updated who gets alerts for ${sites(c)}.`)}
              className={APPLY}
            >
              {busy === "alerts" ? "Applying…" : "Apply"}
            </button>
          </div>
        )}

        {confirming ? (
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-sm text-muted">Remove {sites(n)} and their history?</span>
            <button type="button" disabled={busy !== null} onClick={() => send("delete", { action: "delete" }, (c) => `Removed ${sites(c)}.`)} className="rounded-lg bg-bad px-3 py-1.5 text-sm font-medium text-background disabled:opacity-50">
              {busy === "delete" ? "Removing…" : "Yes, remove"}
            </button>
            <button type="button" disabled={busy !== null} onClick={() => setConfirming(false)} className={BUTTON}>
              Cancel
            </button>
          </div>
        ) : (
          <button type="button" disabled={busy !== null} onClick={() => setConfirming(true)} className="rounded-lg border border-bad/50 px-3 py-1.5 text-sm text-bad hover:bg-bad/10 disabled:opacity-50">
            Remove…
          </button>
        )}

        <button type="button" onClick={onClear} disabled={busy !== null} className="ml-auto text-sm text-muted underline underline-offset-2 hover:text-foreground">
          Clear selection
        </button>
      </div>
      {message && (
        <p role="status" className="mt-2 flex items-center gap-2 rounded-lg bg-ok-bg px-3 py-2 text-sm font-medium text-ok">
          <span aria-hidden>✓</span>
          {message}
        </p>
      )}
      {error && (
        <p role="alert" className="mt-2 text-sm text-bad">
          {error}
        </p>
      )}
    </div>
  );
}
