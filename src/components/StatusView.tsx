"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { useEffect, useState } from "react";
import { BrandMark } from "@/components/branding-context";
import type { publicStatus } from "@/lib/status-page";
import { type Branding, applyTheme, resetTheme } from "@/lib/theme";

type Status = ReturnType<typeof publicStatus> & { branding: Branding };
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

/** One example of each kind of day, for the legend and for reserving room for the message. */
const SAMPLES: (number | null)[] = [100, 97, 80, null];
/** A long-looking date used to size the hidden messages, so a real one never needs more room. */
const WIDE_DAY = Date.UTC(2026, 8, 28);

/** What each daily bar's colour means, in the words shown when a bar is clicked. */
function barMeaning(uptime: number | null): { color: string; label: string; text: string } {
  if (uptime === null) return { color: "bg-border", label: "No data", text: "We weren't checking this site on this day, so there is nothing to show." };
  if (uptime >= 99.9) return { color: "bg-ok", label: "Fully operational", text: "The site was up for practically the whole day (99.9% or more)." };
  if (uptime >= 95) return { color: "bg-warn", label: "Some downtime", text: "The site was down for part of the day (between 95% and 99.9% uptime)." };
  return { color: "bg-bad", label: "Major downtime", text: "The site was down for a large part of the day (under 95% uptime)." };
}

/**
 * The last 30 days as daily bars, oldest on the left and newest on the right. A site we only started watching recently
 * starts at the left and fills towards the right as days pass, rather than sitting in a row of empty bars. Each bar can be
 * clicked (or tabbed to) to read what its colour means.
 */
function DailyBars({ days }: { days: { day: number; uptime: number | null }[] }) {
  const [picked, setPicked] = useState<number | null>(null);
  // Days before the first check have nothing to show; they're left out so the bars start at the left edge.
  const first = days.findIndex((d) => d.uptime !== null);
  const shown = first === -1 ? days.slice(-1) : days.slice(first);
  const empty = days.length - shown.length;
  const chosen = shown.find((d) => d.day === picked) ?? null;
  const meaning = chosen ? barMeaning(chosen.uptime) : null;
  const share = `${(shown.length / days.length) * 100}%`;

  return (
    <div className="mt-6" role="group" aria-label="Daily uptime for the last 30 days. Select a day for details.">
      <div className="flex gap-[3px]">
        {shown.map((day) => {
          const m = barMeaning(day.uptime);
          const on = day.day === picked;
          return (
            <button
              key={day.day}
              type="button"
              aria-pressed={on}
              aria-label={`${fmtDate(day.day)}: ${m.label}${day.uptime === null ? "" : `, ${day.uptime}% uptime`}`}
              title={`${fmtDate(day.day)}: ${day.uptime === null ? "no data" : `${day.uptime}% uptime`}`}
              onClick={() => setPicked(on ? null : day.day)}
              className={`h-9 min-w-0 flex-1 rounded-sm outline-none hover:opacity-80 focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2 focus-visible:ring-offset-background ${m.color} ${
                on ? "ring-2 ring-foreground ring-offset-2 ring-offset-background" : ""
              }`}
            />
          );
        })}
        {Array.from({ length: empty }, (_, i) => (
          <div key={`later-${i}`} aria-hidden className="h-9 min-w-0 flex-1 rounded-sm border border-dashed border-border" />
        ))}
      </div>
      <div className="mt-1.5 text-xs text-muted" style={{ width: share }}>
        <div className="flex justify-between gap-2">
          <span className="truncate">{shown.length === days.length ? "30 days ago" : fmtDate(shown[0].day)}</span>
          <span className="shrink-0">Today</span>
        </div>
      </div>
      <p className="mt-0.5 text-xs text-muted">Each bar is one day (UTC).</p>

      {/* Every possible message sits in the same spot, and only the current one is visible, so the box keeps one height whatever is picked. */}
      <div aria-live="polite" className="mt-3 grid min-h-28 rounded-xl border border-border bg-surface px-4 py-3 text-sm sm:min-h-0">
        <ul className={`col-start-1 row-start-1 flex flex-wrap content-start gap-x-5 gap-y-1.5 text-muted ${chosen ? "invisible" : ""}`}>
          <li className="w-full text-xs">Select a day to see what its colour means.</li>
          {SAMPLES.map((u) => {
            const m = barMeaning(u);
            return (
              <li key={m.label} className="flex items-center gap-2 text-xs">
                <span aria-hidden className={`h-3 w-3 rounded-sm ${m.color}`} />
                {m.label}
              </li>
            );
          })}
        </ul>
        {SAMPLES.map((u) => {
          const m = barMeaning(u);
          const active = chosen !== null && meaning?.label === m.label;
          const day = active ? chosen : null;
          const uptime = day ? day.uptime : 100;
          return (
            <div key={m.label} className={`col-start-1 row-start-1 flex items-start gap-3 ${active ? "" : "invisible"}`}>
              <span aria-hidden className={`mt-1 h-3 w-3 shrink-0 rounded-sm ${m.color}`} />
              <div>
                <p className="font-medium">
                  {fmtDate(day ? day.day : WIDE_DAY)} · {m.label}
                  {uptime !== null && <span className="font-normal text-muted"> · {uptime}% uptime</span>}
                </p>
                <p className="mt-0.5 text-muted">{m.text}</p>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

/**
 * A public status page. `slug` is given when the page is shown on a customer's own domain (`customDomain`), and
 * otherwise comes from the address (/status/<slug>).
 */
export default function StatusView({ slug: given, customDomain = false }: { slug?: string; customDomain?: boolean }) {
  const params = useParams<{ slug?: string }>();
  const slug = given ?? params?.slug ?? "";
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

  // The owner's light/dark and colour, for as long as this page is open.
  const look = load.kind === "ok" ? load.data.branding : null;
  useEffect(() => {
    if (!look) return;
    applyTheme(look);
    return () => resetTheme();
  }, [look?.mode, look?.accent]); // eslint-disable-line react-hooks/exhaustive-deps

  // White label: on their own domain, or when they've asked us to leave our credit off, nothing says Site Monitors.
  // The server only reports the setting for accounts whose plan includes it.
  const whiteLabel = customDomain || (load.kind === "ok" && load.data.branding.hideCredit);
  const siteName = load.kind === "ok" ? load.data.host : null;
  const logo = load.kind === "ok" ? load.data.branding.logoUrl : null;
  useEffect(() => {
    if (!whiteLabel || !siteName) return;
    document.title = `${siteName} status`;
    // The browser tab shouldn't show our icon: the owner's logo if they have one, otherwise nothing.
    document.querySelectorAll('link[rel~="icon"], link[rel="apple-touch-icon"]').forEach((l) => l.remove());
    const icon = document.createElement("link");
    icon.rel = "icon";
    icon.href = logo ?? "data:,";
    document.head.appendChild(icon);
  }, [whiteLabel, siteName, logo]);

  // The credit stays on every page unless white label is on, even when the owner has put their own logo at the top.
  const footer =
    whiteLabel ? null : (
      <footer className="mt-12 border-t border-border pt-6 text-center text-xs text-muted">
        Run by{" "}
        <Link href="/" className="text-accent underline underline-offset-2">
          site-monitors.net
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
      {d.branding.logoUrl && (
        <div className="mb-8">
          <BrandMark branding={d.branding} />
        </div>
      )}
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

        <DailyBars days={d.days} />
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
