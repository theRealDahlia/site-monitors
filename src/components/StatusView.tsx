"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { useEffect, useState } from "react";
import { BRAND } from "@/lib/brand";
import type { publicStatus } from "@/lib/status-page";

type Status = ReturnType<typeof publicStatus>;
type Load = { kind: "loading" } | { kind: "missing" } | { kind: "error" } | { kind: "ok"; data: Status };

function ago(ms: number | null): string {
  if (!ms) return "not yet";
  const mins = Math.max(0, Math.round((Date.now() - ms) / 60_000));
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins} min ago`;
  const hours = Math.round(mins / 60);
  return hours < 24 ? `${hours} hr ago` : `${Math.round(hours / 24)} days ago`;
}

function duration(from: number, to: number): string {
  const mins = Math.max(1, Math.round((to - from) / 60_000));
  if (mins < 60) return `${mins} minute${mins === 1 ? "" : "s"}`;
  const hours = Math.floor(mins / 60);
  const rest = mins % 60;
  return `${hours} hour${hours === 1 ? "" : "s"}${rest ? ` ${rest} min` : ""}`;
}

// The daily bars are UTC days. Showing their midnight in the viewer's own time zone would label them a day early for anyone behind UTC.
const fmtDate = (ms: number) => new Date(ms).toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric", timeZone: "UTC" });
const fmtTime = (ms: number) => new Date(ms).toLocaleString(undefined, { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" });
const show = (v: number | null) => (v === null ? "—" : `${v}%`);

function barColor(uptime: number | null): string {
  if (uptime === null) return "bg-border";
  if (uptime >= 99.9) return "bg-ok";
  if (uptime >= 95) return "bg-warn";
  return "bg-bad";
}

export default function StatusView() {
  const { slug } = useParams<{ slug: string }>();
  const [load, setLoad] = useState<Load>({ kind: "loading" });

  useEffect(() => {
    let cancelled = false;
    const run = () => {
      fetch(`/api/status/${encodeURIComponent(slug)}`)
        .then(async (res): Promise<Load> => {
          if (res.status === 404) return { kind: "missing" };
          if (!res.ok) return { kind: "error" };
          return { kind: "ok", data: await res.json() };
        })
        .catch((): Load => ({ kind: "error" }))
        .then((next) => {
          // Keep showing the last good data through a brief network blip rather than flashing an error.
          if (!cancelled) setLoad((prev) => (next.kind === "error" && prev.kind === "ok" ? prev : next));
        });
    };
    run();
    const t = setInterval(run, 30_000);
    return () => {
      cancelled = true;
      clearInterval(t);
    };
  }, [slug]);

  const footer = (
    <footer className="mt-12 border-t border-border pt-6 text-center text-xs text-muted">
      Monitoring by{" "}
      <Link href="/" className="text-accent underline underline-offset-2">
        {BRAND}
      </Link>
    </footer>
  );

  if (load.kind === "loading") {
    return <main className="mx-auto max-w-2xl px-4 py-16 text-muted sm:px-6">Loading status…</main>;
  }
  if (load.kind === "missing") {
    return (
      <main className="mx-auto max-w-2xl px-4 py-16 sm:px-6">
        <h1 className="text-2xl font-semibold tracking-tight">Status page not found</h1>
        <p className="mt-3 text-muted">This page doesn&apos;t exist, or its owner has switched it off.</p>
        {footer}
      </main>
    );
  }
  if (load.kind === "error") {
    return (
      <main className="mx-auto max-w-2xl px-4 py-16 sm:px-6">
        <p role="alert" className="rounded-lg bg-warn-bg px-4 py-3 text-sm text-warn">
          Couldn&apos;t load the status right now. Try again in a moment.
        </p>
      </main>
    );
  }

  const d = load.data;
  const banner =
    d.status === "operational"
      ? { text: "All systems operational", classes: "bg-ok-bg text-ok" }
      : d.status === "down"
        ? { text: "Down", classes: "bg-bad-bg text-bad" }
        : { text: "Checking…", classes: "border border-border bg-surface text-muted" };

  return (
    <main className="mx-auto max-w-2xl px-4 py-12 sm:px-6 sm:py-16">
      <h1 className="break-all text-3xl font-semibold tracking-tight">{d.host}</h1>
      <p className="mt-1 text-sm text-muted">Status page</p>

      <div role="status" className={`mt-6 rounded-xl px-5 py-4 ${banner.classes}`}>
        <p className="text-lg font-semibold">{banner.text}</p>
        {d.status === "down" && d.downSince && <p className="mt-0.5 text-sm">Down since {fmtTime(d.downSince)} ({ago(d.downSince)})</p>}
        {d.status === "operational" && d.responseMs !== null && <p className="mt-0.5 text-sm">Responding in {d.responseMs} ms</p>}
      </div>

      <section aria-labelledby="uptime-heading" className="mt-8">
        <h2 id="uptime-heading" className="text-sm font-medium text-muted">
          Uptime
        </h2>
        <dl className="mt-3 grid grid-cols-3 gap-3 text-center">
          {[
            ["24 hours", d.uptime.last24h],
            ["7 days", d.uptime.last7d],
            ["30 days", d.uptime.last30d],
          ].map(([label, value]) => (
            <div key={label as string} className="rounded-xl border border-border bg-surface px-2 py-4">
              <dd className="text-2xl font-semibold tracking-tight">{show(value as number | null)}</dd>
              <dt className="mt-1 text-xs text-muted">{label as string}</dt>
            </div>
          ))}
        </dl>

        <div className="mt-6" role="img" aria-label="Daily uptime for the last 30 days">
          <div className="flex gap-[3px]">
            {d.days.map((day) => (
              <div
                key={day.day}
                title={`${fmtDate(day.day)}: ${day.uptime === null ? "no data" : `${day.uptime}% uptime`}`}
                className={`h-9 flex-1 rounded-sm ${barColor(day.uptime)}`}
              />
            ))}
          </div>
          <div className="mt-1.5 flex justify-between text-xs text-muted">
            <span>30 days ago</span>
            <span>Today (UTC days)</span>
          </div>
        </div>
      </section>

      <section aria-labelledby="incidents-heading" className="mt-10">
        <h2 id="incidents-heading" className="text-sm font-medium text-muted">
          Past incidents
        </h2>
        {d.incidents.length === 0 ? (
          <p className="mt-3 rounded-xl border border-border bg-surface px-5 py-4 text-sm text-muted">No incidents in the last 30 days.</p>
        ) : (
          <ul className="mt-3 divide-y divide-border rounded-xl border border-border bg-surface">
            {d.incidents.map((i) => (
              <li key={i.startedAt} className="flex flex-wrap items-baseline justify-between gap-2 px-5 py-3.5 text-sm">
                <span>{fmtTime(i.startedAt)}</span>
                <span className={i.endedAt ? "text-muted" : "font-medium text-bad"}>
                  {i.endedAt ? `Resolved after ${duration(i.startedAt, i.endedAt)}` : "Ongoing"}
                </span>
              </li>
            ))}
          </ul>
        )}
      </section>

      <p className="mt-8 text-xs text-muted">Last checked {ago(d.lastCheckedAt)}. This page refreshes by itself.</p>
      {footer}
    </main>
  );
}
