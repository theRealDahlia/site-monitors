"use client";

import { useEffect, useState } from "react";
import type { NoticeView } from "@/lib/status-notices";

const SMALL_BUTTON = "rounded-lg border border-border px-3 py-1.5 text-sm hover:border-accent hover:text-accent disabled:opacity-50";
const PRIMARY = "rounded-lg bg-accent px-4 py-2 text-sm font-medium text-accent-foreground hover:opacity-90 disabled:opacity-50";
const FIELD =
  "w-full min-w-0 rounded-lg border border-border bg-background px-3 py-2 text-sm outline-none placeholder:text-muted/70 focus:border-accent focus:ring-2 focus:ring-accent/30 disabled:opacity-60";
const LABEL = "mb-1 block text-sm font-medium";

const INCIDENT_STATES = [
  ["investigating", "Investigating"],
  ["identified", "Identified"],
  ["monitoring", "Monitoring"],
  ["resolved", "Resolved"],
] as const;

export const STATE_LABEL: Record<string, string> = {
  investigating: "Investigating",
  identified: "Identified",
  monitoring: "Monitoring",
  resolved: "Resolved",
  scheduled: "Scheduled",
  in_progress: "In progress",
  completed: "Completed",
  cancelled: "Cancelled",
};

export const STATE_TONE: Record<string, string> = {
  investigating: "bg-bad-bg text-bad",
  identified: "bg-warn-bg text-warn",
  monitoring: "bg-accent/15 text-accent",
  resolved: "bg-ok-bg text-ok",
  scheduled: "bg-accent/15 text-accent",
  in_progress: "bg-warn-bg text-warn",
  completed: "bg-ok-bg text-ok",
  cancelled: "border border-border text-muted",
};

export const when = (ms: number) => new Date(ms).toLocaleString(undefined, { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" });

/** A datetime-local value for a time, in the person's own time zone. */
const localInput = (ms: number) => {
  const d = new Date(ms - new Date(ms).getTimezoneOffset() * 60_000);
  return d.toISOString().slice(0, 16);
};

export function StateBadge({ state }: { state: string }) {
  return <span className={`inline-block rounded-full px-2 py-0.5 text-xs font-medium ${STATE_TONE[state] ?? STATE_TONE.cancelled}`}>{STATE_LABEL[state] ?? state}</span>;
}

type Busy = string | null;

async function send(url: string, method: string, body?: unknown): Promise<{ ok: true; data: { notice?: NoticeView } } | { ok: false; error: string }> {
  try {
    const res = await fetch(url, { method, headers: body ? { "Content-Type": "application/json" } : undefined, body: body ? JSON.stringify(body) : undefined });
    const data = await res.json();
    return res.ok ? { ok: true, data } : { ok: false, error: data.error ?? "Something went wrong." };
  } catch {
    return { ok: false, error: "Couldn't reach the server. Try again." };
  }
}

function IncidentForm({ onSubmit, busy }: { onSubmit: (body: Record<string, unknown>) => void; busy: boolean }) {
  const [title, setTitle] = useState("");
  const [impact, setImpact] = useState("minor");
  const [state, setState] = useState("investigating");
  const [message, setMessage] = useState("");
  return (
    <form
      className="mt-4 space-y-3 rounded-lg border border-border bg-background p-4"
      onSubmit={(e) => {
        e.preventDefault();
        onSubmit({ kind: "incident", title, impact, state, message });
      }}
    >
      <div>
        <label htmlFor="inc-title" className={LABEL}>
          Title
        </label>
        <input id="inc-title" autoFocus maxLength={120} value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Checkout is slow" className={FIELD} disabled={busy} />
      </div>
      <div className="grid gap-3 sm:grid-cols-2">
        <div>
          <label htmlFor="inc-impact" className={LABEL}>
            How serious
          </label>
          <select id="inc-impact" value={impact} onChange={(e) => setImpact(e.target.value)} className={FIELD} disabled={busy}>
            <option value="minor">Minor: some things are slow or broken</option>
            <option value="major">Major: the service is down</option>
          </select>
        </div>
        <div>
          <label htmlFor="inc-state" className={LABEL}>
            State
          </label>
          <select id="inc-state" value={state} onChange={(e) => setState(e.target.value)} className={FIELD} disabled={busy}>
            {INCIDENT_STATES.map(([id, label]) => (
              <option key={id} value={id}>
                {label}
              </option>
            ))}
          </select>
        </div>
      </div>
      <div>
        <label htmlFor="inc-message" className={LABEL}>
          What&apos;s happening
        </label>
        <textarea id="inc-message" rows={3} maxLength={2000} value={message} onChange={(e) => setMessage(e.target.value)} placeholder="We're looking into reports of slow checkouts." className={FIELD} disabled={busy} />
      </div>
      <button type="submit" className={PRIMARY} disabled={busy || !title.trim() || !message.trim()}>
        {busy ? "Posting…" : "Post incident"}
      </button>
    </form>
  );
}

function MaintenanceForm({ onSubmit, busy }: { onSubmit: (body: Record<string, unknown>) => void; busy: boolean }) {
  const [title, setTitle] = useState("");
  const [start, setStart] = useState(() => localInput(Date.now() + 24 * 3_600_000));
  const [end, setEnd] = useState(() => localInput(Date.now() + 26 * 3_600_000));
  const [message, setMessage] = useState("");
  const [silence, setSilence] = useState(true);
  return (
    <form
      className="mt-4 space-y-3 rounded-lg border border-border bg-background p-4"
      onSubmit={(e) => {
        e.preventDefault();
        onSubmit({ kind: "maintenance", title, message, startsAt: new Date(start).getTime(), endsAt: new Date(end).getTime(), silenceAlerts: silence });
      }}
    >
      <div>
        <label htmlFor="mnt-title" className={LABEL}>
          Title
        </label>
        <input id="mnt-title" autoFocus maxLength={120} value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Database upgrade" className={FIELD} disabled={busy} />
      </div>
      <div className="grid gap-3 sm:grid-cols-2">
        <div>
          <label htmlFor="mnt-start" className={LABEL}>
            Starts
          </label>
          <input id="mnt-start" type="datetime-local" value={start} onChange={(e) => setStart(e.target.value)} className={FIELD} disabled={busy} />
        </div>
        <div>
          <label htmlFor="mnt-end" className={LABEL}>
            Ends
          </label>
          <input id="mnt-end" type="datetime-local" value={end} onChange={(e) => setEnd(e.target.value)} className={FIELD} disabled={busy} />
        </div>
      </div>
      <div>
        <label htmlFor="mnt-message" className={LABEL}>
          Details <span className="font-normal text-muted">(optional)</span>
        </label>
        <textarea id="mnt-message" rows={2} maxLength={2000} value={message} onChange={(e) => setMessage(e.target.value)} placeholder="Expect a few minutes of downtime." className={FIELD} disabled={busy} />
      </div>
      <label className="flex items-start gap-2 text-sm">
        <input type="checkbox" checked={silence} onChange={(e) => setSilence(e.target.checked)} className="mt-0.5 accent-[var(--accent)]" disabled={busy} />
        <span>
          Don&apos;t send down alerts while it&apos;s under way
          <span className="block text-xs text-muted">Checks keep running and outages are still recorded.</span>
        </span>
      </label>
      <p className="text-xs text-muted">Times are in your time zone ({Intl.DateTimeFormat().resolvedOptions().timeZone}).</p>
      <button type="submit" className={PRIMARY} disabled={busy || !title.trim() || !start || !end}>
        {busy ? "Scheduling…" : "Schedule maintenance"}
      </button>
    </form>
  );
}

/** Posting an update to an open incident. */
function UpdateForm({ notice, onSubmit, busy }: { notice: NoticeView; onSubmit: (body: Record<string, unknown>) => void; busy: boolean }) {
  const [state, setState] = useState(notice.state === "investigating" ? "identified" : notice.state === "identified" ? "monitoring" : "resolved");
  const [message, setMessage] = useState("");
  return (
    <form
      className="mt-3 space-y-2"
      onSubmit={(e) => {
        e.preventDefault();
        onSubmit({ action: "update", state, message });
      }}
    >
      <div className="flex flex-col gap-2 sm:flex-row">
        <label htmlFor={`upd-state-${notice.id}`} className="sr-only">
          New state
        </label>
        <select id={`upd-state-${notice.id}`} value={state} onChange={(e) => setState(e.target.value)} className={`${FIELD} sm:w-44`} disabled={busy}>
          {INCIDENT_STATES.map(([id, label]) => (
            <option key={id} value={id}>
              {label}
            </option>
          ))}
        </select>
        <label htmlFor={`upd-msg-${notice.id}`} className="sr-only">
          Update
        </label>
        <input id={`upd-msg-${notice.id}`} autoFocus maxLength={2000} value={message} onChange={(e) => setMessage(e.target.value)} placeholder="What's changed?" className={FIELD} disabled={busy} />
        <button type="submit" className={`${PRIMARY} shrink-0`} disabled={busy || !message.trim()}>
          {busy ? "Posting…" : "Post"}
        </button>
      </div>
    </form>
  );
}

function NoticeItem({ n, busy, onAction, onDelete }: { n: NoticeView; busy: Busy; onAction: (n: NoticeView, body: Record<string, unknown>) => Promise<boolean>; onDelete: (n: NoticeView) => void }) {
  const [updating, setUpdating] = useState(false);
  const [confirming, setConfirming] = useState(false);
  const mine = busy === `n${n.id}`;
  const latest = n.updates[0];
  const open = n.kind === "incident" ? n.state !== "resolved" : n.state === "scheduled" || n.state === "in_progress";
  return (
    <li className="py-3.5">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div className="min-w-0">
          <p className="flex flex-wrap items-center gap-2 font-medium">
            <StateBadge state={n.state} />
            <span className="break-words">{n.title}</span>
            {n.kind === "incident" && n.impact === "major" && <span className="text-xs font-normal text-bad">Major</span>}
          </p>
          <p className="mt-1 text-xs text-muted">
            {n.kind === "maintenance" ? `${when(n.startsAt ?? 0)} to ${when(n.endsAt ?? 0)}${n.silenceAlerts ? " · alerts held back" : ""}` : `Started ${when(n.createdAt)}`}
          </p>
          {latest && <p className="mt-1.5 whitespace-pre-line break-words text-sm text-muted">{latest.message}</p>}
          {n.updates.length > 1 && (
            <details className="mt-1.5 text-sm">
              <summary className="cursor-pointer text-xs text-accent underline underline-offset-2">Earlier updates ({n.updates.length - 1})</summary>
              <ol className="mt-2 space-y-2 border-l border-border pl-3">
                {n.updates.slice(1).map((u) => (
                  <li key={u.id}>
                    <p className="text-xs text-muted">
                      {STATE_LABEL[u.state] ?? u.state} · {when(u.at)}
                    </p>
                    <p className="whitespace-pre-line break-words text-muted">{u.message}</p>
                  </li>
                ))}
              </ol>
            </details>
          )}
        </div>
        <div className="flex flex-wrap gap-2">
          {n.kind === "incident" && !updating && (
            <button type="button" onClick={() => setUpdating(true)} className={SMALL_BUTTON} disabled={busy !== null}>
              {open ? "Post update" : "Reopen"}
            </button>
          )}
          {n.kind === "maintenance" && open && (
            <button type="button" onClick={() => onAction(n, { action: "finish" })} className={SMALL_BUTTON} disabled={busy !== null}>
              {mine ? "Saving…" : n.state === "scheduled" ? "Cancel it" : "End now"}
            </button>
          )}
          {confirming ? (
            <>
              <button type="button" onClick={() => onDelete(n)} className="rounded-lg bg-bad px-3 py-1.5 text-sm font-medium text-background disabled:opacity-50" disabled={busy !== null}>
                Delete
              </button>
              <button type="button" onClick={() => setConfirming(false)} className={SMALL_BUTTON}>
                Keep
              </button>
            </>
          ) : (
            <button type="button" onClick={() => setConfirming(true)} className={SMALL_BUTTON} disabled={busy !== null} aria-label={`Delete ${n.title}`}>
              Delete
            </button>
          )}
        </div>
      </div>
      {updating && (
        <UpdateForm
          notice={n}
          busy={mine}
          onSubmit={async (body) => {
            if (await onAction(n, body)) setUpdating(false);
          }}
        />
      )}
    </li>
  );
}

/** The "Incidents and maintenance" card on a monitor's page: what its status page tells visitors. */
export default function StatusNotices({ monitorId, statusPageOn }: { monitorId: number; statusPageOn: boolean }) {
  const [notices, setNotices] = useState<NoticeView[] | null>(null);
  const [form, setForm] = useState<"incident" | "maintenance" | null>(null);
  const [busy, setBusy] = useState<Busy>(null);
  const [error, setError] = useState<string | null>(null);
  const base = `/api/monitors/${monitorId}/notices`;

  const load = () =>
    fetch(base, { cache: "no-store" })
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => d && setNotices(d.notices))
      .catch(() => {});

  useEffect(() => {
    let cancelled = false;
    fetch(base, { cache: "no-store" })
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => d && !cancelled && setNotices(d.notices))
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [base]);

  async function create(body: Record<string, unknown>) {
    setBusy("new");
    setError(null);
    const r = await send(base, "POST", body);
    if (r.ok) {
      setForm(null);
      await load();
    } else setError(r.error);
    setBusy(null);
  }

  async function act(n: NoticeView, body: Record<string, unknown>): Promise<boolean> {
    setBusy(`n${n.id}`);
    setError(null);
    const r = await send(`${base}/${n.id}`, "POST", body);
    if (r.ok) await load();
    else setError(r.error);
    setBusy(null);
    return r.ok;
  }

  async function remove(n: NoticeView) {
    setBusy(`n${n.id}`);
    setError(null);
    const r = await send(`${base}/${n.id}`, "DELETE");
    if (r.ok) await load();
    else setError(r.error);
    setBusy(null);
  }

  const open = (notices ?? []).filter((n) => (n.kind === "incident" ? n.state !== "resolved" : n.state === "scheduled" || n.state === "in_progress"));
  const done = (notices ?? []).filter((n) => !open.includes(n));

  return (
    <section className="rounded-xl border border-border bg-surface p-5" aria-labelledby="notices-heading">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 id="notices-heading" className="font-semibold">
            Incidents and maintenance
          </h2>
          <p className="mt-0.5 text-sm text-muted">
            {statusPageOn ? "Tell visitors to the status page what's going on, in your own words." : "These show on the status page once it's turned on."}
          </p>
        </div>
        <div className="flex gap-2">
          <button type="button" onClick={() => setForm(form === "incident" ? null : "incident")} aria-expanded={form === "incident"} className={SMALL_BUTTON}>
            Report an incident
          </button>
          <button type="button" onClick={() => setForm(form === "maintenance" ? null : "maintenance")} aria-expanded={form === "maintenance"} className={SMALL_BUTTON}>
            Schedule maintenance
          </button>
        </div>
      </div>

      {form === "incident" && <IncidentForm onSubmit={create} busy={busy === "new"} />}
      {form === "maintenance" && <MaintenanceForm onSubmit={create} busy={busy === "new"} />}
      {error && (
        <p role="alert" className="mt-3 rounded-lg bg-bad-bg px-4 py-3 text-sm text-bad">
          {error}
        </p>
      )}

      {notices === null ? (
        <p className="mt-3 text-sm text-muted">Loading…</p>
      ) : notices.length === 0 ? (
        <p className="mt-3 text-sm text-muted">Nothing posted in the last 30 days.</p>
      ) : (
        <>
          {open.length > 0 && (
            <ul className="mt-3 divide-y divide-border border-t border-border">
              {open.map((n) => (
                <NoticeItem key={n.id} n={n} busy={busy} onAction={act} onDelete={remove} />
              ))}
            </ul>
          )}
          {done.length > 0 && (
            <details className="mt-3">
              <summary className="cursor-pointer text-sm text-muted hover:text-foreground">Past {done.length === 1 ? "notice" : `notices (${done.length})`}</summary>
              <ul className="mt-1 divide-y divide-border">
                {done.map((n) => (
                  <NoticeItem key={n.id} n={n} busy={busy} onAction={act} onDelete={remove} />
                ))}
              </ul>
            </details>
          )}
        </>
      )}
    </section>
  );
}
