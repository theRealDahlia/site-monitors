"use client";

import Link from "next/link";
import { useState } from "react";
import { useBranding } from "@/components/branding-context";
import CustomDomainPanel from "@/components/CustomDomainPanel";
import { useMonitors } from "@/components/monitor-ui";
import Toggle from "@/components/Toggle";

/** The White label tab (Pro): your own domain for each status page, and no Site Monitors credit on them. */
export default function WhiteLabel() {
  const { branding, setBranding, whiteLabel } = useBranding();
  const { data, loadError } = useMonitors("/dashboard/white-label");
  const [busy, setBusy] = useState(false);
  const [status, setStatus] = useState<{ ok: boolean; text: string } | null>(null);

  async function setCredit(hide: boolean) {
    if (!branding || busy) return;
    setBusy(true);
    setStatus(null);
    try {
      const res = await fetch("/api/branding", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ mode: branding.mode, accent: branding.accent, hideCredit: hide }),
      });
      const body = await res.json();
      if (!res.ok) throw new Error(body.error ?? "Couldn't save.");
      setBranding(body);
      setStatus({ ok: true, text: "Saved" });
    } catch (err) {
      setStatus({ ok: false, text: err instanceof Error && err.message !== "Failed to fetch" ? err.message : "Couldn't reach the server. Try again." });
    }
    setBusy(false);
  }

  if (!branding || !data) {
    return loadError ? (
      <p role="alert" className="rounded-lg bg-bad-bg px-4 py-3 text-sm text-bad">
        {loadError}
      </p>
    ) : (
      <p className="text-muted">Loading…</p>
    );
  }

  const withPage = data.monitors.filter((m) => m.statusPage.enabled && m.statusPage.slug);
  const without = data.monitors.length - withPage.length;

  return (
    <div>
      <h1 className="flex flex-wrap items-center gap-3 text-3xl font-semibold tracking-tight">
        White label
        {!whiteLabel && <span className="rounded-full border border-border px-2.5 py-0.5 text-sm font-medium text-muted">Pro</span>}
      </h1>
      <p className="mt-2 text-muted">Make your public status pages look like they come from your company, not from us.</p>

      {!whiteLabel ? (
        <section className="mt-6 rounded-xl border border-border bg-surface p-5">
          <h2 className="font-semibold">Part of the Pro plan</h2>
          <ul className="mt-2 list-disc space-y-1 pl-5 text-sm text-muted">
            <li>Show a status page at your own address, like status.yourcompany.com, with a secure certificate we set up for you</li>
            <li>Leave &ldquo;Run by site-monitors.net&rdquo; off your status pages</li>
            <li>Your logo and colours, from the Appearance tab, on every page</li>
          </ul>
          <Link href="/dashboard/plans" className="mt-4 inline-block rounded-lg bg-accent px-4 py-2 text-sm font-medium text-accent-foreground hover:opacity-90">
            See the plans
          </Link>
        </section>
      ) : (
        <>
          <section className="mt-6 rounded-xl border border-border bg-surface p-5" aria-labelledby="credit-heading">
            <div className="flex items-start justify-between gap-4">
              <div className="min-w-0">
                <h2 id="credit-heading" className="font-semibold">
                  Hide our credit
                </h2>
                <p className="mt-0.5 text-sm text-muted">
                  Leave &ldquo;Run by site-monitors.net&rdquo; off your status pages, so they carry only your own logo and colours. Pages on your own domain never show it.
                </p>
                {status && (
                  <p role={status.ok ? "status" : "alert"} className={`mt-2 text-sm ${status.ok ? "text-ok" : "text-bad"}`}>
                    {status.text}
                  </p>
                )}
              </div>
              <Toggle on={branding.hideCredit} disabled={busy} label="Leave Site Monitors off my status pages" onChange={setCredit} />
            </div>
          </section>

          <section className="mt-4" aria-labelledby="domains-heading">
            <h2 id="domains-heading" className="font-semibold">
              Status page domains
            </h2>
            <p className="mt-0.5 text-sm text-muted">Each site&apos;s status page can have its own address. Your logo and colours are set on the Appearance tab.</p>

            {withPage.length === 0 ? (
              <p className="mt-4 rounded-xl border border-dashed border-border p-6 text-center text-sm text-muted">
                None of your sites has a public status page yet. Turn one on under{" "}
                <Link href="/dashboard/sites" className="text-accent underline underline-offset-2">
                  Manage sites
                </Link>
                , then come back to give it your own domain.
              </p>
            ) : (
              <ul className="mt-4 space-y-4">
                {withPage.map((m) => (
                  <li key={m.id} className="rounded-xl border border-border bg-surface p-5">
                    <h3 className="break-all text-lg font-semibold">{m.host}</h3>
                    <p className="text-xs text-muted">/status/{m.statusPage.slug}</p>
                    <CustomDomainPanel monitorId={m.id} />
                  </li>
                ))}
              </ul>
            )}
            {withPage.length > 0 && without > 0 && (
              <p className="mt-4 text-sm text-muted">
                {without} of your sites {without === 1 ? "has" : "have"} no public status page. Turn it on under{" "}
                <Link href="/dashboard/sites" className="text-accent underline underline-offset-2">
                  Manage sites
                </Link>
                .
              </p>
            )}
          </section>
        </>
      )}
    </div>
  );
}
