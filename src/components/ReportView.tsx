"use client";

import { useParams } from "next/navigation";
import { useEffect, useState } from "react";
import { BrandMark } from "@/components/branding-context";
import type { ReportData } from "@/lib/reports";
import { DEFAULT_BRANDING, applyTheme, resetTheme } from "@/lib/theme";

const date = (ms: number) => new Date(ms).toLocaleString("en-US", { month: "short", day: "numeric", hour: "numeric", minute: "2-digit", timeZone: "UTC" });
const mins = (m: number) => (m < 60 ? `${m} min` : `${Math.floor(m / 60)} h ${m % 60 ? `${m % 60} min` : ""}`.trim());
const days = (d: number | null, status: string) =>
  status === "pending" || status === "unknown" || status === "unsupported" || status === "error" || status === "unreachable" ? "—" : d === null ? "—" : d < 0 ? "Expired" : `${d} days`;

/** A client's monthly uptime report, as opened from the link in its email. Prints cleanly, to save as a PDF. */
export default function ReportView() {
  const params = useParams<{ token: string }>();
  const token = params?.token ?? "";
  const [data, setData] = useState<ReportData | null | "missing">(null);

  useEffect(() => {
    let cancelled = false;
    fetch(`/api/report/${encodeURIComponent(token)}`)
      .then((r) => (r.ok ? r.json() : "missing"))
      .then((d) => !cancelled && setData(d))
      .catch(() => !cancelled && setData("missing"));
    return () => {
      cancelled = true;
    };
  }, [token]);

  // The tab (and a saved PDF's title) carries the report's own name, not ours.
  const title = data && data !== "missing" ? `${data.name}: uptime report, ${data.monthName}` : null;
  useEffect(() => {
    if (title) document.title = title;
  }, [title]);

  // The owner's accent colour, always on a light page: reports are for reading and printing.
  const accent = data && data !== "missing" ? data.branding.accent : null;
  useEffect(() => {
    if (!accent) return;
    applyTheme({ mode: "light", accent });
    return () => resetTheme();
  }, [accent]);

  if (data === null) return <main className="mx-auto max-w-3xl px-4 py-16 text-muted">Loading report…</main>;
  if (data === "missing") {
    return (
      <main className="mx-auto max-w-3xl px-4 py-16">
        <h1 className="text-2xl font-semibold">Report not found</h1>
        <p className="mt-2 text-muted">This link isn&apos;t valid, or the report is no longer available.</p>
      </main>
    );
  }

  const brand = { ...DEFAULT_BRANDING, logoUrl: data.branding.logoUrl, name: data.branding.name };
  return (
    <main className="mx-auto max-w-3xl px-4 py-10 sm:px-6 print:max-w-none print:px-0 print:py-0">
      <div className="flex flex-wrap items-start justify-between gap-4">
        {brand.logoUrl || brand.name ? <BrandMark branding={brand} /> : <span />}
        <button type="button" onClick={() => window.print()} className="rounded-lg border border-border px-3 py-1.5 text-sm hover:border-accent hover:text-accent print:hidden">
          Save as PDF
        </button>
      </div>

      <h1 className="mt-8 text-3xl font-semibold tracking-tight">{data.name}</h1>
      <p className="mt-1 text-muted">
        Uptime report for {data.monthName}
        {data.partial && " (so far this month)"}
      </p>

      <dl className="mt-6 grid grid-cols-2 gap-3 sm:grid-cols-4">
        {[
          ["Sites", data.summary.sites],
          [`Met the ${data.slaTarget}% target`, `${data.summary.met} of ${data.summary.sites}`],
          ["Outages", data.summary.outages],
          ["Total downtime", data.summary.downMinutes ? mins(data.summary.downMinutes) : "None"],
        ].map(([label, value]) => (
          <div key={label as string} className="rounded-xl border border-border px-4 py-3 print:break-inside-avoid">
            <dd className="text-xl font-semibold tracking-tight">{value}</dd>
            <dt className="mt-0.5 text-xs text-muted">{label}</dt>
          </div>
        ))}
      </dl>

      <section className="mt-8 space-y-4">
        {data.sites.map((s) => (
          <article key={s.host} className="rounded-xl border border-border p-5 print:break-inside-avoid">
            <div className="flex flex-wrap items-baseline justify-between gap-2">
              <h2 className="break-all text-lg font-semibold">{s.host}</h2>
              <p className={`text-lg font-semibold ${s.metTarget === false ? "text-bad" : s.metTarget ? "text-ok" : "text-muted"}`}>
                {s.uptime === null ? "No data" : `${s.uptime}%`}
              </p>
            </div>
            <p className="text-sm text-muted">
              {s.metTarget === null ? "Not enough checks this month to measure." : s.metTarget ? `Met the ${data.slaTarget}% target.` : `Below the ${data.slaTarget}% target.`}
              {s.avgMs !== null && ` Average response ${s.avgMs} ms.`}
            </p>

            <dl className="mt-3 grid gap-x-6 gap-y-1 text-sm sm:grid-cols-3">
              <div>
                <dt className="text-muted">Outages</dt>
                <dd>{s.outages.length ? `${s.outages.length}, ${mins(s.downMinutes)} in total` : "None"}</dd>
              </div>
              {s.ssl && (
                <div>
                  <dt className="text-muted">SSL certificate</dt>
                  <dd>{days(s.ssl.days, s.ssl.status)} left</dd>
                </div>
              )}
              {s.domain && (
                <div>
                  <dt className="text-muted">Domain registration</dt>
                  <dd>{days(s.domain.days, s.domain.status)} left</dd>
                </div>
              )}
            </dl>

            {s.outages.length > 0 && (
              <ul className="mt-3 space-y-1 border-t border-border pt-3 text-sm">
                {s.outages.map((o) => (
                  <li key={o.start} className="flex flex-wrap justify-between gap-2">
                    <span>{date(o.start)} UTC</span>
                    <span className="text-muted">{o.end ? `down for ${mins(o.minutes)}` : "still down"}</span>
                  </li>
                ))}
              </ul>
            )}
            {s.notices.length > 0 && (
              <ul className="mt-3 space-y-1 border-t border-border pt-3 text-sm">
                {s.notices.map((n) => (
                  <li key={`${n.kind}${n.at}`}>
                    <span className="text-muted">{n.kind === "maintenance" ? "Maintenance" : "Incident"}, {date(n.at)}:</span> {n.title}
                  </li>
                ))}
              </ul>
            )}
          </article>
        ))}
      </section>

      <p className="mt-8 text-xs text-muted">
        Uptime is the share of checks that found each site working. Times are in UTC.
        {!data.branding.hideCredit && " Monitoring by site-monitors.net."}
      </p>
    </main>
  );
}
