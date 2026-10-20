"use client";

import Link from "next/link";
import { useEffect, useState } from "react";

interface Data {
  historyDays: number;
  months: { month: string; uptime: number | null; avgMs: number | null }[];
}

const name = (month: string) => new Date(`${month}-01T00:00:00Z`).toLocaleDateString(undefined, { month: "long", year: "numeric", timeZone: "UTC" });
const tone = (u: number | null) => (u === null ? "bg-border" : u >= 99.9 ? "bg-ok" : u >= 99 ? "bg-warn" : "bg-bad");

/** Month-by-month uptime on a monitor's page, as far back as the plan shows. */
export default function MonitorHistory({ monitorId }: { monitorId: number }) {
  const [data, setData] = useState<Data | null>(null);
  useEffect(() => {
    let cancelled = false;
    fetch(`/api/monitors/${monitorId}/history`, { cache: "no-store" })
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => d && !cancelled && setData(d))
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [monitorId]);

  if (!data) return null;
  return (
    <section className="rounded-xl border border-border bg-surface p-5" aria-labelledby="history-heading">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <h2 id="history-heading" className="font-semibold">
          History
        </h2>
        <p className="text-xs text-muted">
          {data.historyDays >= 365 ? "The last 12 months." : `The last ${data.historyDays} days. `}
          {data.historyDays < 365 && (
            <Link href="/dashboard/plans" className="text-accent underline underline-offset-2">
              12 months on Pro
            </Link>
          )}
        </p>
      </div>
      {data.months.length === 0 ? (
        <p className="mt-2 text-sm text-muted">No checks recorded yet.</p>
      ) : (
        <ul className="mt-3 space-y-2 text-sm">
          {data.months.map((m) => (
            <li key={m.month} className="grid grid-cols-[8.5rem_1fr_auto] items-center gap-3">
              <span className="text-muted">{name(m.month)}</span>
              <span className="h-2 overflow-hidden rounded-full bg-border" aria-hidden>
                {/* The bar spans 95% to 100%, where the differences that matter are. */}
                <span className={`block h-full rounded-full ${tone(m.uptime)}`} style={{ width: `${m.uptime === null ? 0 : Math.max(2, ((m.uptime - 95) / 5) * 100)}%` }} />
              </span>
              <span className="w-28 text-right tabular-nums">
                {m.uptime === null ? "no data" : `${m.uptime}%`}
                {m.avgMs !== null && <span className="block text-xs text-muted">{m.avgMs} ms avg</span>}
              </span>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
