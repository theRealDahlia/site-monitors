"use client";

import Link from "next/link";
import type { Monitor } from "@/components/monitor-ui";
import { ago } from "@/components/monitor-ui";
import type { Finding } from "@/lib/health-scan";

const TONE: Record<Finding["tone"], { label: string; classes: string }> = {
  problem: { label: "Fix", classes: "bg-bad-bg text-bad" },
  notice: { label: "Suggestion", classes: "bg-warn-bg text-warn" },
  info: { label: "Note", classes: "border border-border text-muted" },
  good: { label: "Good", classes: "bg-ok-bg text-ok" },
};
const GRADE: Record<string, string> = { A: "text-ok", B: "text-ok", C: "text-warn", D: "text-bad", F: "text-bad" };

function Findings({ items }: { items: Finding[] }) {
  return (
    <ul className="mt-2 space-y-2">
      {items.map((f) => (
        <li key={f.id} className="text-sm">
          <p className="flex flex-wrap items-center gap-2 font-medium">
            <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${TONE[f.tone].classes}`}>{TONE[f.tone].label}</span>
            {f.title}
          </p>
          <p className="mt-0.5 break-words text-muted">{f.detail}</p>
        </li>
      ))}
    </ul>
  );
}

function Part({ title, aside, children }: { title: string; aside?: React.ReactNode; children: React.ReactNode }) {
  return (
    <details className="group border-t border-border py-3">
      <summary className="flex cursor-pointer list-none items-center justify-between gap-3">
        <span className="font-medium">{title}</span>
        <span className="flex items-center gap-2 text-sm">
          {aside}
          <span aria-hidden className="text-muted transition-transform group-open:rotate-90">
            ›
          </span>
        </span>
      </summary>
      <div className="mt-1">{children}</div>
    </details>
  );
}

const count = (items: Finding[], tone: Finding["tone"]) => items.filter((f) => f.tone === tone).length;
function summary(items: Finding[]) {
  const p = count(items, "problem");
  const n = count(items, "notice");
  if (p) return <span className="text-bad">{p} to fix</span>;
  if (n) return <span className="text-warn">{n} suggestion{n === 1 ? "" : "s"}</span>;
  return <span className="text-ok">All good</span>;
}

/** The health scan card on a site's page: DNS, email setup, security headers and broken links. */
export default function HealthScan({ m }: { m: Monitor }) {
  if (m.kind !== "site") return null;
  if (!m.scan) {
    return (
      <section className="rounded-xl border border-border bg-surface p-5" aria-labelledby="scan-heading">
        <h2 id="scan-heading" className="font-semibold">
          Health scan
        </h2>
        <p className="mt-1 text-sm text-muted">
          A daily look at this site&apos;s DNS records (with an alert when they change), its email setup (SPF, DKIM and DMARC) and its security headers. Part of the{" "}
          <Link href="/dashboard/plans" className="text-accent underline underline-offset-2">
            Starter plan
          </Link>
          .
        </p>
      </section>
    );
  }
  const r = m.scan.result;
  return (
    <section className="rounded-xl border border-border bg-surface p-5" aria-labelledby="scan-heading">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <h2 id="scan-heading" className="font-semibold">
          Health scan
        </h2>
        <p className="text-xs text-muted">{r ? `Scanned ${ago(m.scan.checkedAt)}. Runs daily.` : "The first scan runs within a few minutes."}</p>
      </div>
      {r && (
        <div className="mt-3">
          <Part title="DNS records" aside={r.dns ? <span className="text-muted">We&apos;ll tell you if they change</span> : <span className="text-muted">Couldn&apos;t look up</span>}>
            {r.dns ? (
              <dl className="grid grid-cols-[6rem_1fr] gap-x-3 gap-y-1 text-sm">
                {(
                  [
                    ["A", r.dns.a],
                    ["AAAA", r.dns.aaaa],
                    ["CNAME", r.dns.cname],
                    ["MX", r.dns.mx],
                    ["NS", r.dns.ns],
                  ] as const
                ).map(([k, v]) => (
                  <div key={k} className="contents">
                    <dt className="text-muted">{k}</dt>
                    <dd className="min-w-0 break-all">{v.length ? v.join(", ") : <span className="text-muted">none</span>}</dd>
                  </div>
                ))}
              </dl>
            ) : (
              <p className="text-sm text-muted">The DNS lookups didn&apos;t answer this time. We&apos;ll try again tomorrow.</p>
            )}
          </Part>
          <Part title="Email setup" aside={r.email ? summary(r.email.findings) : <span className="text-muted">Couldn&apos;t look up</span>}>
            {r.email ? <Findings items={r.email.findings} /> : <p className="text-sm text-muted">The DNS lookups didn&apos;t answer this time.</p>}
          </Part>
          <Part title="Security headers" aside={r.headers ? <span className={`font-semibold ${GRADE[r.headers.grade]}`}>Grade {r.headers.grade}</span> : <span className="text-muted">Couldn&apos;t load</span>}>
            {r.headers ? <Findings items={r.headers.findings} /> : <p className="text-sm text-muted">We couldn&apos;t load the homepage: {r.homepageError ?? "no answer"}.</p>}
          </Part>
          <Part
            title="Broken links"
            aside={
              !m.scan.links ? (
                <span className="text-muted">Pro</span>
              ) : r.links ? (
                r.links.broken.length ? (
                  <span className="text-warn">{r.links.broken.length} broken</span>
                ) : r.links.checked === 0 ? (
                  <span className="text-muted">No links</span>
                ) : (
                  <span className="text-ok">All {r.links.checked} work</span>
                )
              ) : (
                <span className="text-muted">Not checked yet</span>
              )
            }
          >
            {!m.scan.links ? (
              <p className="text-sm text-muted">
                A weekly check of every link on the homepage is part of the{" "}
                <Link href="/dashboard/plans" className="text-accent underline underline-offset-2">
                  Pro plan
                </Link>
                .
              </p>
            ) : !r.links ? (
              <p className="text-sm text-muted">The links are checked once a week; the first check runs with the next scan.</p>
            ) : r.links.checked === 0 ? (
              <p className="text-sm text-muted">The homepage has no links to check. Checked {ago(r.linksAt)}, weekly.</p>
            ) : r.links.broken.length === 0 ? (
              <p className="text-sm text-muted">
                All {r.links.checked} links on the homepage work. Checked {ago(r.linksAt)}, weekly.
              </p>
            ) : (
              <ul className="space-y-1 text-sm">
                {r.links.broken.map((b) => (
                  <li key={b.url} className="flex flex-wrap justify-between gap-2">
                    <span className="min-w-0 break-all">{b.url}</span>
                    <span className="text-bad">{b.status ? `HTTP ${b.status}` : b.error}</span>
                  </li>
                ))}
              </ul>
            )}
          </Part>
        </div>
      )}
    </section>
  );
}
