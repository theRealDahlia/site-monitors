"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import TargetPicker, { type Target } from "@/components/TargetPicker";
import Toggle from "@/components/Toggle";

interface Policy {
  enabled: boolean;
  afterMs: number;
  targets: string[];
}

const minutes = (ms: number) => `${ms / 60_000} minutes`;

/** The escalation rule, on the Integrations page (Pro): who else to tell when an outage goes unacknowledged. */
export default function EscalationSettings() {
  const [data, setData] = useState<{ allowed: boolean; policy: Policy; afterChoices: number[] } | null>(null);
  const [targets, setTargets] = useState<Target[]>([]);
  const [draft, setDraft] = useState<Policy | null>(null);
  const [busy, setBusy] = useState(false);
  const [status, setStatus] = useState<{ ok: boolean; text: string } | null>(null);

  useEffect(() => {
    let cancelled = false;
    Promise.all([fetch("/api/escalation", { cache: "no-store" }), fetch("/api/alert-targets", { cache: "no-store" })])
      .then(async ([a, b]) => {
        if (!a.ok || !b.ok || cancelled) return;
        const d = await a.json();
        setData(d);
        setDraft(d.policy);
        setTargets((await b.json()).targets);
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, []);

  async function save(next: Policy) {
    setBusy(true);
    setStatus(null);
    try {
      const res = await fetch("/api/escalation", { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify(next) });
      const body = await res.json();
      if (!res.ok) setStatus({ ok: false, text: body.error ?? "Couldn't save." });
      else {
        setDraft(body.policy);
        setData((d) => d && { ...d, policy: body.policy });
        setStatus({ ok: true, text: "Saved" });
      }
    } catch {
      setStatus({ ok: false, text: "Couldn't reach the server. Try again." });
    }
    setBusy(false);
  }

  if (!data || !draft) return null;

  return (
    <section className="mt-4 rounded-xl border border-border bg-surface p-5" aria-labelledby="escalation-heading">
      <div className="flex items-start justify-between gap-4">
        <div className="min-w-0">
          <h2 id="escalation-heading" className="flex flex-wrap items-center gap-2 font-semibold">
            Escalation
            {!data.allowed && <span className="rounded-full border border-border px-2 py-0.5 text-xs font-medium text-muted">Pro</span>}
          </h2>
          <p className="mt-0.5 text-sm text-muted">
            If nobody acknowledges an outage alert in time, tell someone else. Every outage alert gets an &ldquo;Acknowledge&rdquo; link. The people you choose here only hear
            about outages nobody has acknowledged, unless a monitor sends its alerts to them directly.
          </p>
        </div>
        {data.allowed && (
          <Toggle
            on={draft.enabled}
            disabled={busy}
            label="Escalate unacknowledged outages"
            onChange={(on) => (on && draft.targets.length === 0 ? setDraft({ ...draft, enabled: true }) : save({ ...draft, enabled: on }))}
          />
        )}
      </div>

      {!data.allowed ? (
        <p className="mt-3 text-sm text-muted">
          Escalation is part of the Pro plan.{" "}
          <Link href="/dashboard/plans" className="text-accent underline underline-offset-2">
            See the plans
          </Link>
          .
        </p>
      ) : (
        draft.enabled && (
          <div className="mt-4 space-y-3">
            <div>
              <label htmlFor="esc-after" className="mb-1 block text-sm font-medium">
                Wait for
              </label>
              <select
                id="esc-after"
                value={draft.afterMs}
                disabled={busy}
                onChange={(e) => setDraft({ ...draft, afterMs: Number(e.target.value) })}
                className="rounded-lg border border-border bg-background px-3 py-2 text-sm"
              >
                {data.afterChoices.map((ms) => (
                  <option key={ms} value={ms}>
                    {minutes(ms)}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <p className="mb-1.5 text-sm font-medium">Then tell</p>
              <TargetPicker targets={targets} chosen={new Set(draft.targets)} onChange={(next) => setDraft({ ...draft, targets: [...next] })} disabled={busy} idPrefix="esc" />
            </div>
            <button type="button" onClick={() => save(draft)} disabled={busy || draft.targets.length === 0} className="rounded-lg bg-accent px-4 py-2 text-sm font-medium text-accent-foreground hover:opacity-90 disabled:opacity-50">
              {busy ? "Saving…" : "Save escalation"}
            </button>
          </div>
        )
      )}
      {status && (
        <p role={status.ok ? "status" : "alert"} className={`mt-2 text-sm ${status.ok ? "text-ok" : "text-bad"}`}>
          {status.text}
        </p>
      )}
    </section>
  );
}
