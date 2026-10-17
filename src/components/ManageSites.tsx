"use client";

import { useState } from "react";
import { type Monitor, StatusBadge, day, useMonitors } from "@/components/monitor-ui";

const INPUT =
  "min-w-0 flex-1 rounded-lg border border-border bg-surface px-4 py-3 text-base outline-none placeholder:text-muted/70 focus:border-accent focus:ring-2 focus:ring-accent/30 disabled:opacity-60";
const SMALL_BUTTON = "rounded-lg border border-border px-3 py-1.5 text-sm hover:border-accent hover:text-accent disabled:opacity-50";

type Busy = "saving" | "deleting";

/** Mounted only while editing, so the field always starts from the site's current hostname. */
function EditForm({ m, busy, onSave, onCancel }: { m: Monitor; busy: Busy | undefined; onSave: (host: string) => void; onCancel: () => void }) {
  const [value, setValue] = useState(m.host);
  return (
    <form
      className="mt-4"
      onSubmit={(e) => {
        e.preventDefault();
        onSave(value);
      }}
    >
      <label htmlFor={`edit-${m.id}`} className="mb-1.5 block text-sm font-medium">
        Domain name
      </label>
      <div className="flex flex-col gap-2 sm:flex-row">
        <input
          id={`edit-${m.id}`}
          type="text"
          inputMode="url"
          autoCapitalize="none"
          autoCorrect="off"
          spellCheck={false}
          autoFocus
          value={value}
          disabled={busy === "saving"}
          onChange={(e) => setValue(e.target.value)}
          onKeyDown={(e) => e.key === "Escape" && onCancel()}
          className={INPUT}
        />
        <div className="flex gap-2">
          <button
            type="submit"
            disabled={busy === "saving" || !value.trim()}
            className="rounded-lg bg-accent px-4 py-2.5 text-sm font-medium text-accent-foreground hover:opacity-90 disabled:opacity-50"
          >
            {busy === "saving" ? "Saving & re-checking…" : "Save"}
          </button>
          <button type="button" onClick={onCancel} disabled={busy === "saving"} className={SMALL_BUTTON}>
            Cancel
          </button>
        </div>
      </div>
      <p className="mt-2 text-xs text-muted">
        Saving a new domain clears this site&apos;s old results, runs the uptime, SSL and domain checks again, and emails you a summary of its status.
      </p>
    </form>
  );
}

/** Switch a site's public status page on or off, and share its link. */
function StatusPageControl({ m, allowed, onChanged }: { m: Monitor; allowed: boolean; onChanged: () => Promise<void> }) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const enabled = m.statusPage.enabled && !!m.statusPage.slug;
  const link = m.statusPage.slug ? `${typeof window === "undefined" ? "" : window.location.origin}/status/${m.statusPage.slug}` : "";

  async function toggle() {
    setBusy(true);
    setError(null);
    try {
      const res = await fetch(`/api/monitors/${m.id}/status-page`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ enabled: !enabled }),
      });
      if (!res.ok) setError((await res.json()).error ?? "Something went wrong.");
      else await onChanged();
    } catch {
      setError("Couldn't reach the server. Try again.");
    }
    setBusy(false);
  }

  async function copy() {
    try {
      await navigator.clipboard.writeText(link);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      setError("Couldn't copy. Select the link and copy it yourself.");
    }
  }

  if (!allowed) {
    return <p className="mt-4 border-t border-border pt-4 text-sm text-muted">A public status page for this site is part of the Starter plan.</p>;
  }

  return (
    <div className="mt-4 border-t border-border pt-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="text-sm font-medium">Public status page</p>
          <p className="text-xs text-muted">
            {enabled ? "Anyone with the link can see this site's status and uptime." : "Off. Share a live status and uptime page for this site."}
          </p>
        </div>
        <button onClick={toggle} disabled={busy} role="switch" aria-checked={enabled} className={SMALL_BUTTON}>
          {busy ? "Saving…" : enabled ? "Turn off" : "Turn on"}
        </button>
      </div>
      {enabled && (
        <div className="mt-3 flex flex-col gap-2 sm:flex-row sm:items-center">
          <input readOnly value={link} aria-label="Status page link" onFocus={(e) => e.currentTarget.select()} className="min-w-0 flex-1 rounded-lg border border-border bg-background px-3 py-2 text-sm text-muted" />
          <div className="flex gap-2">
            <button onClick={copy} className={SMALL_BUTTON}>
              {copied ? "Copied" : "Copy link"}
            </button>
            <a href={link} target="_blank" rel="noopener noreferrer" className={SMALL_BUTTON}>
              Open
            </a>
          </div>
        </div>
      )}
      {error && (
        <p role="alert" className="mt-2 text-sm text-bad">
          {error}
        </p>
      )}
    </div>
  );
}

function SiteRow({
  m,
  statusPagesAllowed,
  onChanged,
  editing,
  busy,
  confirming,
  error,
  onEdit,
  onCancelEdit,
  onSave,
  onAskDelete,
  onCancelDelete,
  onDelete,
}: {
  m: Monitor;
  statusPagesAllowed: boolean;
  onChanged: () => Promise<void>;
  editing: boolean;
  busy: Busy | undefined;
  confirming: boolean;
  error: string | undefined;
  onEdit: () => void;
  onCancelEdit: () => void;
  onSave: (host: string) => void;
  onAskDelete: () => void;
  onCancelDelete: () => void;
  onDelete: () => void;
}) {
  return (
    <li className="rounded-xl border border-border bg-surface p-4 sm:p-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="min-w-0">
          <p className="break-all font-semibold">{m.host}</p>
          <p className="mt-0.5 text-xs text-muted">Added {day(m.createdAt)}</p>
        </div>
        <StatusBadge status={m.overall} />
      </div>

      {!editing && <StatusPageControl m={m} allowed={statusPagesAllowed} onChanged={onChanged} />}

      {editing ? (
        <EditForm m={m} busy={busy} onSave={onSave} onCancel={onCancelEdit} />
      ) : (
        <div className="mt-4 flex flex-wrap items-center gap-2 border-t border-border pt-4">
          {confirming ? (
            <>
              <span className="text-sm text-muted">Stop watching {m.host}?</span>
              <button
                onClick={onDelete}
                disabled={busy === "deleting"}
                className="rounded-lg bg-bad px-3 py-1.5 text-sm font-medium text-background disabled:opacity-50"
              >
                {busy === "deleting" ? "Removing…" : "Yes, remove"}
              </button>
              <button onClick={onCancelDelete} className={SMALL_BUTTON}>
                Cancel
              </button>
            </>
          ) : (
            <>
              <button onClick={onEdit} className={SMALL_BUTTON}>
                Edit
              </button>
              <button onClick={onAskDelete} className={SMALL_BUTTON}>
                Remove
              </button>
            </>
          )}
        </div>
      )}

      {error && (
        <p role="alert" className="mt-3 rounded-lg bg-bad-bg px-4 py-3 text-sm text-bad">
          {error}
        </p>
      )}
    </li>
  );
}

// ---------- the Manage sites tab ----------

export default function ManageSites() {
  const { data, loadError, reload } = useMonitors("/dashboard/sites");
  const [host, setHost] = useState("");
  const [adding, setAdding] = useState(false);
  const [addError, setAddError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [confirmingId, setConfirmingId] = useState<number | null>(null);
  const [busyId, setBusyId] = useState<{ id: number; what: Busy } | null>(null);
  const [rowError, setRowError] = useState<{ id: number; message: string } | null>(null);

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

  async function saveEdit(id: number, newHost: string) {
    setBusyId({ id, what: "saving" });
    setRowError(null);
    setNotice(null);
    try {
      const res = await fetch(`/api/monitors/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ host: newHost }),
      });
      const body = await res.json();
      if (!res.ok) {
        setRowError({ id, message: body.error ?? "Something went wrong." });
      } else {
        setEditingId(null);
        if (body.changed) setNotice(`Updated. We re-ran every check for ${body.monitor.host} and emailed you a summary.`);
        await reload();
      }
    } catch {
      setRowError({ id, message: "Couldn't reach the server. Try again." });
    }
    setBusyId(null);
  }

  async function removeSite(id: number) {
    setBusyId({ id, what: "deleting" });
    setRowError(null);
    try {
      const res = await fetch(`/api/monitors/${id}`, { method: "DELETE" });
      if (res.ok) {
        const body = await res.json();
        setConfirmingId(null);
        setNotice(
          body.emailed
            ? "Site removed. We've stopped watching it and emailed you a confirmation."
            : "Site removed. We've stopped watching it. We couldn't send the confirmation email, but it's recorded in your Notifications.",
        );
        await reload();
      } else {
        setRowError({ id, message: (await res.json()).error ?? "Couldn't remove it." });
      }
    } catch {
      setRowError({ id, message: "Couldn't reach the server. Try again." });
    }
    setBusyId(null);
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

  return (
    <div>
      <h1 className="text-3xl font-semibold tracking-tight">Manage sites</h1>
      <p className="mt-2 text-muted">Add, edit or remove the sites we watch for you.</p>

      <section className="mt-6 rounded-xl border border-border bg-surface p-5">
        <div className="flex flex-wrap items-baseline justify-between gap-2">
          <h2 className="font-semibold">Add a site</h2>
          <p className="text-sm text-muted">
            {data.monitors.length} of {data.limit} sites · {data.plan.name} plan
          </p>
        </div>
        <form onSubmit={addSite} className="mt-3 flex flex-col gap-3 sm:flex-row">
          <label htmlFor="new-site" className="sr-only">
            Domain name
          </label>
          <input
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
          {full && " You've reached your limit. Remove a site to add another."}
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
          <ul className="mt-3 space-y-3">
            {data.monitors.map((m) => (
              <SiteRow
                key={m.id}
                m={m}
                statusPagesAllowed={data.plan.statusPages}
                onChanged={reload}
                editing={editingId === m.id}
                busy={busyId?.id === m.id ? busyId.what : undefined}
                confirming={confirmingId === m.id}
                error={rowError?.id === m.id ? rowError.message : undefined}
                onEdit={() => {
                  setEditingId(m.id);
                  setConfirmingId(null);
                  setRowError(null);
                  setNotice(null);
                }}
                onCancelEdit={() => {
                  setEditingId(null);
                  setRowError(null);
                }}
                onSave={(h) => saveEdit(m.id, h)}
                onAskDelete={() => {
                  setConfirmingId(m.id);
                  setRowError(null);
                }}
                onCancelDelete={() => setConfirmingId(null)}
                onDelete={() => removeSite(m.id)}
              />
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
