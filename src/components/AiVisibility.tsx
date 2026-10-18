"use client";

import Link from "next/link";
import { useState } from "react";
import AiVisibilityRow from "@/components/AiVisibilityRow";
import { type Monitor, useMonitors, useNotice } from "@/components/monitor-ui";

const BUTTON = "rounded-lg border border-border px-3 py-1.5 text-sm hover:border-accent hover:text-accent disabled:opacity-50";

const AI_BADGE: Record<string, { label: string; classes: string }> = {
  ok: { label: "Readable", classes: "bg-ok-bg text-ok" },
  attention: { label: "Could be better", classes: "bg-warn-bg text-warn" },
  problem: { label: "Blocked", classes: "bg-bad-bg text-bad" },
  unknown: { label: "Couldn't tell", classes: "border border-border text-muted" },
  pending: { label: "Not checked yet", classes: "border border-border text-muted" },
};

/** The badge for this page is about AI access only, not the site's uptime, so it never shows "Checking…" because of another check. */
function AiBadge({ ai }: { ai: NonNullable<Monitor["ai"]> }) {
  const badge = AI_BADGE[ai.result?.status ?? ai.status] ?? AI_BADGE.pending;
  return <span className={`shrink-0 rounded-full px-3 py-1 text-sm font-medium ${badge.classes}`}>{badge.label}</span>;
}

/** The AI visibility tab (Pro): can AI search tools reach and read each of your sites? */
export default function AiVisibility() {
  const { data, loadError, reload } = useMonitors("/dashboard/ai-visibility");
  const [checking, setChecking] = useState<number | null>(null);
  const [notice, setNotice] = useNotice();

  async function checkNow(m: Monitor) {
    setChecking(m.id);
    setNotice(null);
    try {
      const res = await fetch(`/api/monitors/${m.id}/check`, { method: "POST" });
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
      <p className="text-muted">Loading…</p>
    );
  }

  return (
    <div>
      <h1 className="flex flex-wrap items-center gap-3 text-3xl font-semibold tracking-tight">
        AI visibility
        {!data.plan.aiVisibility && <span className="rounded-full border border-border px-2.5 py-0.5 text-sm font-medium text-muted">Pro</span>}
      </h1>
      <p className="mt-2 text-muted">
        Once a day we check whether AI search tools, like ChatGPT search, Claude, Perplexity and Google, can reach and read each of your sites, and we email you if one gets blocked.
      </p>

      {!data.plan.aiVisibility ? (
        <section className="mt-6 rounded-xl border border-border bg-surface p-5">
          <h2 className="font-semibold">Part of the Pro plan</h2>
          <ul className="mt-2 list-disc space-y-1 pl-5 text-sm text-muted">
            <li>Reads your robots.txt the way each AI crawler does</li>
            <li>Asks your server for a page using each crawler&apos;s name, to catch firewalls that turn them away</li>
            <li>Flags pages hidden with noindex, and pages that are empty until JavaScript runs</li>
            <li>Emails you when a site becomes blocked, and again when it recovers</li>
          </ul>
          <Link href="/dashboard/plans" className="mt-4 inline-block rounded-lg bg-accent px-4 py-2 text-sm font-medium text-accent-foreground hover:opacity-90">
            See the plans
          </Link>
        </section>
      ) : (
        <>
          {(notice || loadError) && (
            <p role="alert" className="mt-4 rounded-lg bg-warn-bg px-4 py-3 text-sm text-warn">
              {notice ?? loadError}
            </p>
          )}
          {data.monitors.length === 0 ? (
            <p className="mt-6 rounded-xl border border-dashed border-border p-6 text-center text-muted">
              No sites yet.{" "}
              <Link href="/dashboard/sites" className="text-accent underline underline-offset-2">
                Add one
              </Link>{" "}
              and its first AI check runs within minutes.
            </p>
          ) : (
            <ul className="mt-6 space-y-4">
              {data.monitors.map((m) => (
                <li key={m.id} className="rounded-xl border border-border bg-surface p-5">
                  <div className="flex items-start justify-between gap-3">
                    <h2 className="min-w-0 break-all text-lg font-semibold">{m.host}</h2>
                    {m.ai && <AiBadge ai={m.ai} />}
                  </div>
                  <dl className="mt-3 border-t border-border">{m.ai && <AiVisibilityRow ai={m.ai} />}</dl>
                  <div className="mt-1 flex justify-end border-t border-border pt-3">
                    <button onClick={() => checkNow(m)} disabled={checking !== null} className={BUTTON}>
                      {checking === m.id ? "Checking…" : "Check now"}
                    </button>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </>
      )}
    </div>
  );
}
