"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import type { Monitor } from "@/components/monitor-ui";
import TargetPicker, { type Target } from "@/components/TargetPicker";

const SMALL_BUTTON = "rounded-lg border border-border px-3 py-1.5 text-sm hover:border-accent hover:text-accent disabled:opacity-50";

/** The "Alerts" card on a monitor's page: who gets its alerts, and acknowledging an outage that's going on. */
export default function MonitorAlerts({ m, onChanged }: { m: Monitor; onChanged: () => Promise<void> }) {
  const [data, setData] = useState<{ routing: boolean; escalation: boolean; targets: Target[] } | null>(null);
  const [editing, setEditing] = useState(false);
  const [chosen, setChosen] = useState<Set<string>>(new Set());
  const [busy, setBusy] = useState<"save" | "ack" | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    fetch("/api/alert-targets", { cache: "no-store" })
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => d && !cancelled && setData(d))
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, []);

  async function save(targets: string[] | null) {
    setBusy("save");
    setError(null);
    try {
      const res = await fetch(`/api/monitors/${m.id}/alerts`, { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ targets }) });
      if (!res.ok) setError((await res.json()).error ?? "Couldn't save.");
      else {
        setEditing(false);
        await onChanged();
      }
    } catch {
      setError("Couldn't reach the server. Try again.");
    }
    setBusy(null);
  }

  async function ack() {
    setBusy("ack");
    setError(null);
    try {
      const res = await fetch(`/api/monitors/${m.id}/ack`, { method: "POST" });
      if (!res.ok) setError((await res.json()).error ?? "Couldn't acknowledge it.");
      await onChanged();
    } catch {
      setError("Couldn't reach the server. Try again.");
    }
    setBusy(null);
  }

  const named = m.alertTargets && data ? data.targets.filter((t) => m.alertTargets!.includes(t.id)) : [];
  const o = m.outage;

  return (
    <section className="rounded-xl border border-border bg-surface p-5" aria-labelledby="alerts-heading">
      <h2 id="alerts-heading" className="font-semibold">
        Alerts
      </h2>

      {o && (
        <div className="mt-3 flex flex-wrap items-center justify-between gap-3 rounded-lg bg-bad-bg px-4 py-3 text-sm text-bad">
          <p>
            {o.ackAt
              ? `Outage acknowledged ${new Date(o.ackAt).toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit" })}. Nobody else will be alerted about it.`
              : o.escalatedAt
                ? "Nobody acknowledged this outage in time, so it was escalated."
                : "This monitor is down. Acknowledge it to let everyone know it's being dealt with."}
          </p>
          {!o.ackAt && (
            <button type="button" onClick={ack} disabled={busy !== null} className="rounded-lg bg-bad px-3 py-1.5 text-sm font-medium text-background disabled:opacity-50">
              {busy === "ack" ? "Saving…" : "Acknowledge"}
            </button>
          )}
        </div>
      )}

      {!data ? (
        <p className="mt-2 text-sm text-muted">Loading…</p>
      ) : !editing ? (
        <div className="mt-2 flex flex-wrap items-center justify-between gap-3">
          <p className="text-sm text-muted">
            {m.alertTargets
              ? `Sent only to ${named.map((t) => t.label).join(", ") || "destinations that no longer exist"}.`
              : "Sent to every address and channel that's switched on in Integrations."}
          </p>
          {data.routing ? (
            <button
              type="button"
              className={SMALL_BUTTON}
              onClick={() => {
                setChosen(new Set(m.alertTargets ?? data.targets.filter((t) => t.active).map((t) => t.id)));
                setEditing(true);
              }}
            >
              Choose who gets them
            </button>
          ) : (
            <span className="text-xs text-muted">
              Choosing per monitor is part of the{" "}
              <Link href="/dashboard/plans" className="text-accent underline underline-offset-2">
                Starter plan
              </Link>
              .
            </span>
          )}
        </div>
      ) : (
        <div className="mt-3">
          <TargetPicker targets={data.targets} chosen={chosen} onChange={setChosen} disabled={busy !== null} idPrefix={`route-${m.id}`} />
          <div className="mt-3 flex flex-wrap gap-2">
            <button type="button" onClick={() => save([...chosen])} disabled={busy !== null || chosen.size === 0} className="rounded-lg bg-accent px-4 py-2 text-sm font-medium text-accent-foreground hover:opacity-90 disabled:opacity-50">
              {busy === "save" ? "Saving…" : "Save"}
            </button>
            {m.alertTargets && (
              <button type="button" onClick={() => save(null)} disabled={busy !== null} className={SMALL_BUTTON}>
                Send to everyone again
              </button>
            )}
            <button type="button" onClick={() => setEditing(false)} disabled={busy !== null} className={SMALL_BUTTON}>
              Cancel
            </button>
          </div>
          <p className="mt-2 text-xs text-muted">Add more addresses and channels in Integrations. Changes to who&apos;s added there apply here too.</p>
        </div>
      )}

      {error && (
        <p role="alert" className="mt-2 text-sm text-bad">
          {error}
        </p>
      )}
    </section>
  );
}
