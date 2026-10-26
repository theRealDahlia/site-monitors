"use client";

import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { useState } from "react";
import AiVisibilityRow from "@/components/AiVisibilityRow";
import { KINDS } from "@/components/Notifications";
import StatusNotices from "@/components/StatusNotices";
import StatusSubscribers from "@/components/StatusSubscribers";
import MonitorAlerts from "@/components/MonitorAlerts";
import MonitorHistory from "@/components/MonitorHistory";
import HealthScan from "@/components/HealthScan";
import { useBranding } from "@/components/branding-context";
import { type Monitor, StatusBadge, ago, day, lastChecked, useAutoClear, useCheckNow, useMonitors } from "@/components/monitor-ui";
import { EMPTY_FIELDS, type Kind, KindFields, type MonitorFields, fieldsBody, fieldsReady } from "@/components/AddMonitor";
import { DomainRow, HeartbeatRows, PageRows, PortRow, SslRow, UptimeRow, siteStatus } from "@/components/site-health";

const SMALL_BUTTON = "rounded-lg border border-border px-3 py-1.5 text-sm hover:border-accent hover:text-accent disabled:opacity-50";
const CARD = "rounded-xl border border-border bg-surface p-5";

type Busy = "saving" | "deleting";

/** The current settings of a monitor, as form fields. */
function fieldsOf(m: Monitor): MonitorFields {
  const t = m.target;
  return {
    ...EMPTY_FIELDS,
    host: m.host,
    url: t.url ?? "",
    keyword: t.keyword ?? "",
    keywordMode: t.keywordMode ?? "contains",
    server: t.server ?? "",
    port: t.port ? String(t.port) : "",
    name: m.host,
    everyMs: t.heartbeat?.everyMs ?? EMPTY_FIELDS.everyMs,
    graceMs: t.heartbeat?.graceMs ?? EMPTY_FIELDS.graceMs,
  };
}

/** Mounted only while editing, so the fields always start from the monitor's current settings. */
function EditForm({ m, busy, onSave, onCancel }: { m: Monitor; busy: Busy | undefined; onSave: (body: Record<string, unknown>) => void; onCancel: () => void }) {
  const [f, setF] = useState<MonitorFields>(() => fieldsOf(m));
  const kind = m.kind as Kind;
  return (
    <form
      className="mt-4"
      onSubmit={(e) => {
        e.preventDefault();
        onSave(fieldsBody(kind, f));
      }}
      onKeyDown={(e) => e.key === "Escape" && onCancel()}
    >
      <KindFields kind={kind} f={f} set={(patch) => setF((prev) => ({ ...prev, ...patch }))} disabled={busy === "saving"} idPrefix={`edit-${m.id}`} autoFocus />
      <div className="mt-3 flex gap-2">
        <button
          type="submit"
          disabled={busy === "saving" || !fieldsReady(kind, f)}
          className="rounded-lg bg-accent px-4 py-2.5 text-sm font-medium text-accent-foreground hover:opacity-90 disabled:opacity-50"
        >
          {busy === "saving" ? "Saving & re-checking…" : "Save"}
        </button>
        <button type="button" onClick={onCancel} disabled={busy === "saving"} className={SMALL_BUTTON}>
          Cancel
        </button>
      </div>
      <p className="mt-2 text-xs text-muted">Saving clears this monitor&apos;s old results, checks it again, and emails you a summary.</p>
    </form>
  );
}

/** Where a heartbeat's job sends its check-ins, with ready-to-paste examples. */
function PingAddress({ url }: { url: string }) {
  const [copied, setCopied] = useState<string | null>(null);
  const examples = [
    ["Address", url],
    ["Shell or cron", `curl -fsS -m 10 --retry 3 ${url} > /dev/null`],
  ];
  async function copy(label: string, value: string) {
    try {
      await navigator.clipboard.writeText(value);
      setCopied(label);
      setTimeout(() => setCopied(null), 1500);
    } catch {
      /* the text is selectable */
    }
  }
  return (
    <div className="mt-4 rounded-lg border border-border bg-background p-4">
      <p className="text-sm font-medium">Ping address</p>
      <p className="text-xs text-muted">Call this from the end of your job each time it runs successfully. Keep it private: anyone with it can check in for the job.</p>
      <div className="mt-3 space-y-2">
        {examples.map(([label, value]) => (
          <div key={label}>
            <p className="mb-1 text-xs text-muted">{label}</p>
            <div className="flex items-center gap-2">
              <input readOnly aria-label={label} value={value} onFocus={(e) => e.currentTarget.select()} className="min-w-0 flex-1 rounded-md border border-border bg-surface px-2.5 py-1.5 font-mono text-xs" />
              <button type="button" onClick={() => copy(label, value)} className="shrink-0 rounded-md border border-border px-2.5 py-1.5 text-xs hover:border-accent hover:text-accent">
                {copied === label ? "Copied" : "Copy"}
              </button>
            </div>
          </div>
        ))}
      </div>
    </div>
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
      {enabled && <StatusSubscribers monitorId={m.id} />}
      {error && (
        <p role="alert" className="mt-2 text-sm text-bad">
          {error}
        </p>
      )}
    </>
  );
}


/** Change the site's address, or stop watching it. */
function SiteSettings({ m, clients, onChanged }: { m: Monitor; clients: { id: number; name: string }[]; onChanged: () => Promise<void> }) {
  const router = useRouter();
  const [editing, setEditing] = useState(false);
  const [confirming, setConfirming] = useState(false);
  const [busy, setBusy] = useState<Busy | undefined>();
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  useAutoClear(notice, () => setNotice(null));

  async function setClient(value: string) {
    setBusy("saving");
    setError(null);
    setNotice(null);
    try {
      const res = await fetch("/api/monitors/bulk", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ids: [m.id], action: "client", clientId: value === "" ? null : Number(value) }),
      });
      const body = await res.json();
      if (!res.ok) setError(body.error ?? "Something went wrong.");
      else {
        setNotice(value === "" ? "Taken out of its client." : "Client changed.");
        await onChanged();
      }
    } catch {
      setError("Couldn't reach the server. Try again.");
    }
    setBusy(undefined);
  }

  async function save(fields: Record<string, unknown>) {
    setBusy("saving");
    setError(null);
    setNotice(null);
    try {
      const res = await fetch(`/api/monitors/${m.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(fields),
      });
      const body = await res.json();
      if (!res.ok) setError(body.error ?? "Something went wrong.");
      else {
        setEditing(false);
        if (body.changed) setNotice(`Updated. We checked ${body.monitor.host} again and emailed you a summary.`);
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
      {clients.length > 0 && !editing && (
        <div className="mt-3 max-w-xs">
          <label htmlFor="site-client" className="mb-1 block text-sm font-medium">
            Client
          </label>
          <select
            id="site-client"
            value={m.clientId ?? ""}
            onChange={(e) => setClient(e.target.value)}
            disabled={busy !== undefined}
            className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm outline-none focus:border-accent focus:ring-2 focus:ring-accent/30 disabled:opacity-60"
          >
            <option value="">No client</option>
            {clients.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </select>
        </div>
      )}
      {editing ? (
        <EditForm m={m} busy={busy} onSave={save} onCancel={() => (setEditing(false), setError(null))} />
      ) : (
        <div className="mt-3 flex flex-wrap items-center gap-2">
          {confirming ? (
            <>
              <span className="text-sm text-muted">Stop monitoring {m.host}? Its history goes too.</span>
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
                {{ site: "Change domain", http: "Change page or keyword", tcp: "Change server or port", heartbeat: "Change name or schedule" }[m.kind] ?? "Change"}
              </button>
              <button onClick={() => (setConfirming(true), setError(null))} className={SMALL_BUTTON}>
                {m.kind === "site" ? "Remove site" : "Remove monitor"}
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
            {{ site: "Website", http: "Page", tcp: "Port", heartbeat: "Heartbeat" }[m.kind] ?? "Monitor"} · added {day(m.createdAt)}
            {m.kind !== "heartbeat" && <> · last checked {ago(lastChecked(m))}</>}
          </p>
        </div>
        <StatusBadge status={siteStatus(m)} />
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
            {m.kind !== "heartbeat" && (
              <button onClick={() => checkNow(m.id)} disabled={checking !== null} className={SMALL_BUTTON}>
                {checking === m.id ? "Checking…" : "Check now"}
              </button>
            )}
          </div>
          <dl className="mt-3 divide-y divide-border border-t border-border">
            {m.kind === "http" && <PageRows m={m} />}
            {m.kind === "tcp" && <PortRow m={m} />}
            {m.kind === "heartbeat" && <HeartbeatRows m={m} />}
            {m.kind === "site" && (
              <>
                <UptimeRow m={m} />
                <SslRow m={m} />
                <DomainRow m={m} />
              </>
            )}
            {m.kind !== "site" ? null : m.ai ? (
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
          {m.target.heartbeat && <PingAddress url={m.target.heartbeat.pingUrl} />}
        </section>

        <HealthScan m={m} />

        <MonitorHistory monitorId={m.id} />

        <MonitorAlerts m={m} onChanged={reload} />

        <section className={CARD} aria-label="Public status page">
          <StatusPageControl m={m} allowed={data.plan.statusPages} onChanged={reload} />
        </section>

        {data.plan.statusPages && <StatusNotices monitorId={m.id} statusPageOn={m.statusPage.enabled} />}

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

        <SiteSettings m={m} clients={data.plan.clients ? data.clients : []} onChanged={reload} />
      </div>
    </div>
  );
}
