"use client";

import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { useState } from "react";
import AiVisibilityRow from "@/components/AiVisibilityRow";
import { KINDS } from "@/components/Notifications";
import { useBranding } from "@/components/branding-context";
import { type Monitor, StatusBadge, ago, day, lastChecked, useCheckNow, useMonitors } from "@/components/monitor-ui";
import { DomainRow, SslRow, UptimeRow } from "@/components/site-health";

const INPUT =
  "min-w-0 flex-1 rounded-lg border border-border bg-surface px-4 py-3 text-base outline-none placeholder:text-muted/70 focus:border-accent focus:ring-2 focus:ring-accent/30 disabled:opacity-60";
const SMALL_BUTTON = "rounded-lg border border-border px-3 py-1.5 text-sm hover:border-accent hover:text-accent disabled:opacity-50";
const CARD = "rounded-xl border border-border bg-surface p-5";

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
  const { whiteLabel } = useBranding();
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
    return (
      <>
        <h2 className="font-semibold">Public status page</h2>
        <p className="mt-0.5 text-sm text-muted">
          A live status and uptime page you can share with your clients is part of the Starter plan.{" "}
          <Link href="/dashboard/plans" className="text-accent underline underline-offset-2">
            See the plans
          </Link>
          .
        </p>
      </>
    );
  }

  return (
    <>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="font-semibold">Public status page</h2>
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
      {enabled && (
        <p className="mt-3 text-xs text-muted">
          {whiteLabel ? "Want it at your own address, like status.yourcompany.com? Set that up under" : "Showing it at your own address, like status.yourcompany.com, is part of the Pro plan. See"}{" "}
          <Link href="/dashboard/white-label" className="text-accent underline underline-offset-2">
            White label
          </Link>
          .
        </p>
      )}
      {error && (
        <p role="alert" className="mt-2 text-sm text-bad">
          {error}
        </p>
      )}
    </>
  );
}


/** Change the site's address, or stop watching it. */
function SiteSettings({ m, onChanged }: { m: Monitor; onChanged: () => Promise<void> }) {
  const router = useRouter();
  const [editing, setEditing] = useState(false);
  const [confirming, setConfirming] = useState(false);
  const [busy, setBusy] = useState<Busy | undefined>();
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  async function save(newHost: string) {
    setBusy("saving");
    setError(null);
    setNotice(null);
    try {
      const res = await fetch(`/api/monitors/${m.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ host: newHost }),
      });
      const body = await res.json();
      if (!res.ok) setError(body.error ?? "Something went wrong.");
      else {
        setEditing(false);
        if (body.changed) setNotice(`Updated. We re-ran every check for ${body.monitor.host} and emailed you a summary.`);
        await onChanged();
      }
    } catch {
      setError("Couldn't reach the server. Try again.");
    }
    setBusy(undefined);
  }

  async function remove() {
    setBusy("deleting");
    setError(null);
    try {
      const res = await fetch(`/api/monitors/${m.id}`, { method: "DELETE" });
      if (res.ok) {
        router.replace("/dashboard/sites");
        return;
      }
      setError((await res.json()).error ?? "Couldn't remove it.");
    } catch {
      setError("Couldn't reach the server. Try again.");
    }
    setBusy(undefined);
  }

  return (
    <section className={CARD} aria-labelledby="settings-heading">
      <h2 id="settings-heading" className="font-semibold">
        Settings
      </h2>
      {editing ? (
        <EditForm m={m} busy={busy} onSave={save} onCancel={() => (setEditing(false), setError(null))} />
      ) : (
        <div className="mt-3 flex flex-wrap items-center gap-2">
          {confirming ? (
            <>
              <span className="text-sm text-muted">Stop watching {m.host}? Its history goes too.</span>
              <button onClick={remove} disabled={busy === "deleting"} className="rounded-lg bg-bad px-3 py-1.5 text-sm font-medium text-background disabled:opacity-50">
                {busy === "deleting" ? "Removing…" : "Yes, remove"}
              </button>
              <button onClick={() => setConfirming(false)} className={SMALL_BUTTON}>
                Cancel
              </button>
            </>
          ) : (
            <>
              <button onClick={() => (setEditing(true), setNotice(null), setError(null))} className={SMALL_BUTTON}>
                Change domain
              </button>
              <button onClick={() => (setConfirming(true), setError(null))} className={SMALL_BUTTON}>
                Remove site
              </button>
            </>
          )}
        </div>
      )}
      {notice && (
        <p role="status" className="mt-3 rounded-lg bg-ok-bg px-4 py-3 text-sm text-ok">
          {notice}
        </p>
      )}
      {error && (
        <p role="alert" className="mt-3 rounded-lg bg-bad-bg px-4 py-3 text-sm text-bad">
          {error}
        </p>
      )}
    </section>
  );
}

// ---------- one site's own page ----------

export default function SiteDetail() {
  const params = useParams<{ id: string }>();
  const id = Number(params?.id);
  const { data, loadError, reload } = useMonitors(`/dashboard/sites/${params?.id ?? ""}`);
  const { checking, notice, checkNow } = useCheckNow(reload);

  const back = (
    <Link href="/dashboard/sites" className="text-sm text-muted hover:text-accent">
      ‹ Sites
    </Link>
  );

  if (!data) {
    return loadError ? (
      <p role="alert" className="rounded-lg bg-bad-bg px-4 py-3 text-sm text-bad">
        {loadError}
      </p>
    ) : (
      <p className="text-muted">Loading…</p>
    );
  }

  const m = data.monitors.find((x) => x.id === id);
  if (!m) {
    return (
      <div>
        {back}
        <h1 className="mt-3 text-2xl font-semibold tracking-tight">Site not found</h1>
        <p className="mt-2 text-muted">It may have been removed, or it belongs to another account.</p>
      </div>
    );
  }

  const events = data.events.filter((e) => e.host === m.host).slice(0, 5);

  return (
    <div>
      {back}
      <div className="mt-3 flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <h1 className="break-all text-3xl font-semibold tracking-tight">{m.host}</h1>
          <p className="mt-1 text-sm text-muted">
            Added {day(m.createdAt)} · last checked {ago(lastChecked(m))}
          </p>
        </div>
        <StatusBadge status={m.overall} />
      </div>

      {(notice || loadError) && (
        <p role="alert" className="mt-4 rounded-lg bg-warn-bg px-4 py-3 text-sm text-warn">
          {notice ?? loadError}
        </p>
      )}

      <div className="mt-6 space-y-4">
        <section className={CARD} aria-labelledby="checks-heading">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <h2 id="checks-heading" className="font-semibold">
              Checks
            </h2>
            <button onClick={() => checkNow(m.id)} disabled={checking !== null} className={SMALL_BUTTON}>
              {checking === m.id ? "Checking…" : "Check now"}
            </button>
          </div>
          <dl className="mt-3 divide-y divide-border border-t border-border">
            <UptimeRow m={m} />
            <SslRow m={m} />
            <DomainRow m={m} />
            {m.ai ? (
              <AiVisibilityRow ai={m.ai} compact detailsHref={`/dashboard/ai-visibility#site-${m.id}`} />
            ) : (
              <div className="grid grid-cols-[5.5rem_1fr] gap-3 py-3 text-sm sm:grid-cols-[7rem_1fr]">
                <dt className="text-muted">AI search</dt>
                <dd className="text-muted">
                  Whether AI search tools can read this site is checked on the Pro plan.{" "}
                  <Link href="/dashboard/ai-visibility" className="text-accent underline underline-offset-2">
                    Learn more
                  </Link>
                </dd>
              </div>
            )}
          </dl>
        </section>

        <section className={CARD} aria-label="Public status page">
          <StatusPageControl m={m} allowed={data.plan.statusPages} onChanged={reload} />
        </section>

        <section className={CARD} aria-labelledby="activity-heading">
          <div className="flex flex-wrap items-baseline justify-between gap-2">
            <h2 id="activity-heading" className="font-semibold">
              Recent activity
            </h2>
            {events.length > 0 && (
              <Link href="/dashboard/notifications" className="text-sm text-accent underline underline-offset-2">
                All notifications
              </Link>
            )}
          </div>
          {events.length === 0 ? (
            <p className="mt-2 text-sm text-muted">Nothing yet. Alerts and updates about this site will show up here.</p>
          ) : (
            <ul className="mt-3 divide-y divide-border border-t border-border text-sm">
              {events.map((e) => {
                const kind = KINDS[e.kind];
                return (
                  <li key={e.id} className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1 py-3">
                    <div className="min-w-0">
                      {kind && <span className={`mr-2 inline-block rounded-full px-2 py-0.5 text-xs font-medium ${kind.tone}`}>{kind.label}</span>}
                      <span className="break-words">{e.message}</span>
                    </div>
                    <span className="shrink-0 text-xs text-muted">{ago(e.at)}</span>
                  </li>
                );
              })}
            </ul>
          )}
        </section>

        <SiteSettings m={m} onChanged={reload} />
      </div>
    </div>
  );
}
