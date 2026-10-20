"use client";

import Link from "next/link";
import { useEffect, useState } from "react";

interface Subscriber {
  id: number;
  email: string;
  confirmed: boolean;
  createdAt: number;
}

/** Who follows a status page by email (Pro), with a way to remove someone. */
export default function StatusSubscribers({ monitorId }: { monitorId: number }) {
  const [data, setData] = useState<{ allowed: boolean; subscribers: Subscriber[] } | null>(null);
  const [busy, setBusy] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);
  const base = `/api/monitors/${monitorId}/subscribers`;

  useEffect(() => {
    let cancelled = false;
    fetch(base, { cache: "no-store" })
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => d && !cancelled && setData(d))
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [base]);

  async function remove(s: Subscriber) {
    setBusy(s.id);
    setError(null);
    try {
      const res = await fetch(`${base}/${s.id}`, { method: "DELETE" });
      if (res.ok) setData((d) => d && { ...d, subscribers: d.subscribers.filter((x) => x.id !== s.id) });
      else setError((await res.json()).error ?? "Couldn't remove them.");
    } catch {
      setError("Couldn't reach the server. Try again.");
    }
    setBusy(null);
  }

  if (!data) return null;
  const confirmed = data.subscribers.filter((s) => s.confirmed).length;

  return (
    <div className="mt-4 border-t border-border pt-4">
      <p className="text-sm font-medium">Email subscribers</p>
      {!data.allowed && data.subscribers.length === 0 ? (
        <p className="text-xs text-muted">
          Let visitors sign up for an email whenever there&apos;s news on this page. That&apos;s part of the Pro plan; the page&apos;s RSS feed works on any plan.{" "}
          <Link href="/dashboard/plans" className="text-accent underline underline-offset-2">
            See the plans
          </Link>
        </p>
      ) : data.subscribers.length === 0 ? (
        <p className="text-xs text-muted">Nobody yet. Visitors can sign up at the bottom of the status page, and confirm from their inbox.</p>
      ) : (
        <>
          <p className="text-xs text-muted">
            {confirmed} confirmed{data.subscribers.length > confirmed ? `, ${data.subscribers.length - confirmed} waiting to confirm` : ""}. They&apos;re emailed when you post an incident or
            maintenance, and when our checks confirm an outage.
          </p>
          <details className="mt-2">
            <summary className="cursor-pointer text-xs text-accent underline underline-offset-2">Show the list</summary>
            <ul className="mt-2 divide-y divide-border text-sm">
              {data.subscribers.map((s) => (
                <li key={s.id} className="flex items-center justify-between gap-3 py-2">
                  <span className="min-w-0 truncate">
                    {s.email}
                    {!s.confirmed && <span className="ml-2 text-xs text-muted">not confirmed yet</span>}
                  </span>
                  <button type="button" onClick={() => remove(s)} disabled={busy !== null} className="shrink-0 rounded-md border border-border px-2.5 py-1 text-xs hover:border-accent hover:text-accent disabled:opacity-50">
                    {busy === s.id ? "Removing…" : "Remove"}
                  </button>
                </li>
              ))}
            </ul>
          </details>
        </>
      )}
      {error && (
        <p role="alert" className="mt-2 text-sm text-bad">
          {error}
        </p>
      )}
    </div>
  );
}
