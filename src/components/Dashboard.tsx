"use client";

import Link from "next/link";
import { useState } from "react";
import AiVisibilityRow from "@/components/AiVisibilityRow";
import { type Monitor, StatusBadge, ago, day, daysText, useMonitors, useNotice } from "@/components/monitor-ui";

// ---------- one site ----------

function Row({ label, tone, headline, detail }: { label: string; tone: "ok" | "warn" | "bad" | "muted"; headline: string; detail?: React.ReactNode }) {
  const color = { ok: "text-ok", warn: "text-warn", bad: "text-bad", muted: "text-muted" }[tone];
  return (
    <div className="grid grid-cols-[5.5rem_1fr] gap-3 py-3 text-sm sm:grid-cols-[7rem_1fr]">
      <dt className="text-muted">{label}</dt>
      <dd className="min-w-0">
        <p className={`font-medium ${color}`}>{headline}</p>
        {detail && <div className="mt-0.5 break-words text-muted">{detail}</div>}
      </dd>
    </div>
  );
}

function UptimeRow({ m }: { m: Monitor }) {
  const u = m.uptime;
  if (u.status === "pending") return <Row label="Uptime" tone="muted" headline="Not checked yet" />;
  if (u.status === "down") {
    return (
      <Row
        label="Uptime"
        tone="bad"
        headline="Down"
        detail={`${u.error ?? "No response"}${u.downSince ? ` · since ${ago(u.downSince)}` : ""}`}
      />
    );
  }
  const pct = u.pct24h !== null ? ` · ${u.pct24h}% over 24h` : "";
  return <Row label="Uptime" tone="ok" headline="Up" detail={`HTTP ${u.code ?? "?"} · ${u.ms ?? "?"} ms${pct}`} />;
}

function SslRow({ m }: { m: Monitor }) {
  const s = m.ssl;
  switch (s.status) {
    case "pending":
      return <Row label="SSL" tone="muted" headline="Not checked yet" />;
    case "unreachable":
      return <Row label="SSL" tone="muted" headline="Couldn't check" detail={s.error ?? "Couldn't connect."} />;
    case "invalid":
      return (
        <Row
          label="SSL"
          tone="bad"
          headline="Problem with certificate"
          detail={<ul className="list-inside list-disc">{s.problems.map((p) => <li key={p}>{p}</li>)}</ul>}
        />
      );
    default: {
      const tone = s.status === "valid" ? "ok" : s.status === "expiring" ? "warn" : "bad";
      return (
        <Row
          label="SSL"
          tone={tone}
          headline={daysText(s.days)}
          detail={`Expires ${day(s.expiresAt)}${s.issuer ? ` · issued by ${s.issuer}` : ""}`}
        />
      );
    }
  }
}

function DomainRow({ m }: { m: Monitor }) {
  const d = m.domain;
  switch (d.status) {
    case "pending":
      return <Row label="Domain" tone="muted" headline="Not checked yet" />;
    case "unsupported":
      return <Row label="Domain" tone="muted" headline="Expiry unavailable" detail="This domain extension doesn't publish its expiry date publicly." />;
    case "unknown":
      return <Row label="Domain" tone="muted" headline="Expiry not published" detail={d.name ?? undefined} />;
    case "error":
      return <Row label="Domain" tone="muted" headline="Couldn't check" detail={d.note ?? undefined} />;
    default: {
      const tone = d.status === "ok" ? "ok" : d.status === "expiring" ? "warn" : "bad";
      return (
        <Row
          label="Domain"
          tone={tone}
          headline={daysText(d.days)}
          detail={`${d.name ?? m.host} expires ${day(d.expiresAt)}${d.registrar ? ` · ${d.registrar}` : ""}`}
        />
      );
    }
  }
}

function MonitorCard({ m, busy, onCheck }: { m: Monitor; busy: boolean; onCheck: () => void }) {
  const lastChecked = Math.max(m.uptime.checkedAt ?? 0, m.ssl.checkedAt ?? 0, m.domain.checkedAt ?? 0, m.ai?.checkedAt ?? 0) || null;
  return (
    <li className="rounded-xl border border-border bg-surface p-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="min-w-0">
          <h3 className="break-all text-lg font-semibold">{m.host}</h3>
          <p className="mt-0.5 text-xs text-muted">Added {day(m.createdAt)}</p>
        </div>
        <StatusBadge status={m.overall} />
      </div>

      <dl className="mt-3 divide-y divide-border border-t border-border">
        <UptimeRow m={m} />
        <SslRow m={m} />
        <DomainRow m={m} />
        {m.ai && <AiVisibilityRow ai={m.ai} compact />}
      </dl>

      <div className="mt-3 flex flex-wrap items-center justify-between gap-3 border-t border-border pt-4">
        <p className="text-xs text-muted">Last checked {ago(lastChecked)}</p>
        <button
          onClick={onCheck}
          disabled={busy}
          className="rounded-lg border border-border px-3 py-1.5 text-sm hover:border-accent hover:text-accent disabled:opacity-50"
        >
          {busy ? "Checking…" : "Check now"}
        </button>
      </div>
    </li>
  );
}

// ---------- the Overview tab ----------

export default function Dashboard() {
  const { data, loadError, reload } = useMonitors("/dashboard");
  const [checking, setChecking] = useState<number | null>(null);
  const [notice, setNotice] = useNotice();

  async function checkNow(id: number) {
    setChecking(id);
    setNotice(null);
    try {
      const res = await fetch(`/api/monitors/${id}/check`, { method: "POST" });
      if (res.ok) await reload();
      else setNotice((await res.json()).error ?? "Couldn't run the check.");
    } catch {
      setNotice("Couldn't reach the server. Try again.");
    }
    setChecking(null);
  }

  if (!data) {
    return loadError ? (
      <p role="alert" className="rounded-lg bg-bad-bg px-4 py-3 text-sm text-bad">
        {loadError}
      </p>
    ) : (
      <p className="text-muted">Loading your dashboard…</p>
    );
  }

  return (
    <div>
      <h1 className="text-3xl font-semibold tracking-tight">Overview</h1>
      <Link
        href="/dashboard/sites"
        className="mt-3 inline-flex items-center gap-1.5 rounded-lg bg-accent px-4 py-2 text-sm font-medium text-accent-foreground hover:opacity-90"
      >
        <span aria-hidden>+</span> Add a site
      </Link>
      <p className="mt-4 text-muted">
        We check your sites around the clock and email you automatically when something needs attention. Choose which addresses get
        alerts on the{" "}
        <Link href="/dashboard/integrations" className="text-accent underline underline-offset-2">
          Integrations
        </Link>{" "}
        page.
      </p>

      {(notice || loadError) && (
        <p role="alert" className="mt-4 rounded-lg bg-warn-bg px-4 py-3 text-sm text-warn">
          {notice ?? loadError}
        </p>
      )}

      <section className="mt-6" aria-labelledby="sites-heading">
        <h2 id="sites-heading" className="sr-only">
          Your sites
        </h2>
        {data.monitors.length === 0 ? (
          <div className="rounded-xl border border-dashed border-border p-8 text-center">
            <p className="font-medium">You aren&apos;t watching any sites yet</p>
            <p className="mt-1 text-sm text-muted">Add a domain and we&apos;ll start checking it straight away.</p>
            <Link
              href="/dashboard/sites"
              className="mt-4 inline-block rounded-lg bg-accent px-5 py-2.5 text-sm font-medium text-accent-foreground hover:opacity-90"
            >
              Add your first site
            </Link>
          </div>
        ) : (
          <ul className="space-y-4">
            {data.monitors.map((m) => (
              <MonitorCard key={m.id} m={m} busy={checking === m.id} onCheck={() => checkNow(m.id)} />
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
