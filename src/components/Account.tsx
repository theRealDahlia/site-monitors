"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import Appearance from "@/components/Appearance";

interface Data {
  email: string;
  plan: string;
  role: "owner" | "member";
  hasSubscription: boolean;
  teamMembers: number;
}

/** The Account page: who you are, how the app looks, and a way to delete the account for good. */
export default function Account() {
  const [data, setData] = useState<Data | null>(null);
  const [loadError, setLoadError] = useState(false);
  const [confirming, setConfirming] = useState(false);
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const field = useRef<HTMLInputElement>(null);
  const openButton = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    let cancelled = false;
    fetch("/api/account", { cache: "no-store" })
      .then((r) => (r.ok ? r.json() : Promise.reject()))
      .then((d) => !cancelled && setData(d))
      .catch(() => !cancelled && setLoadError(true));
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (confirming) field.current?.focus();
  }, [confirming]);

  function cancel() {
    setConfirming(false);
    setPassword("");
    setError(null);
    openButton.current?.focus();
  }

  async function remove(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      const res = await fetch("/api/account", { method: "DELETE", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ password }) });
      if (res.ok) {
        // A full load on purpose: nothing in the app belongs to this person any more.
        // eslint-disable-next-line @next/next/no-location-assign-relative-destination
        window.location.assign("/");
        return;
      }
      setError((await res.json().catch(() => ({}))).error ?? "Something went wrong. Please try again.");
    } catch {
      setError("Couldn't reach the server. Check your connection and try again.");
    }
    setBusy(false);
  }

  if (loadError) {
    return (
      <p role="alert" className="rounded-lg bg-warn-bg px-4 py-3 text-sm text-warn">
        Couldn&apos;t load your account. Check your connection.
      </p>
    );
  }
  if (!data) return <p className="text-muted">Loading…</p>;

  return (
    <div>
      <h1 className="text-3xl font-semibold tracking-tight">Account</h1>
      <p className="mt-2 text-muted">Your sign-in details, how the app looks, and account settings.</p>

      <section className="mt-6 rounded-xl border border-border bg-surface p-5" aria-labelledby="account-details">
        <h2 id="account-details" className="font-semibold">
          Details
        </h2>
        <dl className="mt-3 space-y-2 text-sm">
          <div className="flex justify-between gap-4">
            <dt className="text-muted">Email</dt>
            <dd className="truncate font-medium">{data.email}</dd>
          </div>
          {data.role === "owner" && (
            <div className="flex justify-between gap-4">
              <dt className="text-muted">Plan</dt>
              <dd className="font-medium">
                <Link href="/dashboard/plans" className="capitalize underline underline-offset-2">
                  {data.plan}
                </Link>
              </dd>
            </div>
          )}
        </dl>
      </section>

      <Appearance />

      <section className="mt-6 rounded-xl border border-bad/40 bg-surface p-5" aria-labelledby="delete-account">
        <h2 id="delete-account" className="font-semibold text-bad">
          Delete account
        </h2>
        <p className="mt-2 text-sm text-muted">
          {data.role === "member"
            ? "This deletes your own login and anything that belongs to it. The team you work in isn't affected."
            : "This permanently deletes your account and everything in it. It can't be undone."}
        </p>

        {!confirming ? (
          <button
            ref={openButton}
            type="button"
            onClick={() => setConfirming(true)}
            className="mt-4 rounded-lg border border-bad/50 px-4 py-2 text-sm font-medium text-bad transition-colors hover:bg-bad/10"
          >
            Delete account…
          </button>
        ) : (
          <form onSubmit={remove} className="mt-4 space-y-4" onKeyDown={(e) => e.key === "Escape" && !busy && cancel()}>
            <ul className="list-disc space-y-1.5 pl-5 text-sm">
              <li>
                All your sites, check history, alerts, reports, status pages, integrations, API keys and branding are deleted{data.role === "owner" ? "" : " from your own account"}.
              </li>
              {data.hasSubscription && <li>Your paid subscription is cancelled right away, and the unused days are refunded to your card.</li>}
              {data.teamMembers > 0 && (
                <li>
                  {data.teamMembers === 1 ? "The 1 person" : `The ${data.teamMembers} people`} on your team lose access to this account. Their own logins stay.
                </li>
              )}
              <li>Status page links stop working, and nobody can sign in with {data.email} again until it&apos;s used to sign up afresh.</li>
              <li>Download your data first from API &amp; export if you want a copy.</li>
            </ul>
            <div>
              <label htmlFor="delete-password" className="mb-1.5 block text-sm font-medium">
                Enter your password to confirm
              </label>
              <input
                ref={field}
                id="delete-password"
                type="password"
                autoComplete="current-password"
                required
                maxLength={128}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                aria-describedby={error ? "delete-error" : undefined}
                className="w-full max-w-sm rounded-lg border border-border bg-surface px-4 py-2.5 text-base outline-none focus:border-bad focus:ring-2 focus:ring-bad/30"
              />
            </div>
            {error && (
              <p id="delete-error" role="alert" className="text-sm text-bad">
                {error}
              </p>
            )}
            <div className="flex flex-wrap items-center gap-3">
              <button
                type="submit"
                disabled={busy || password.length === 0}
                className="rounded-lg bg-bad px-4 py-2 text-sm font-medium text-white transition-opacity hover:opacity-90 disabled:opacity-50"
              >
                {busy ? "Deleting…" : "Permanently delete my account"}
              </button>
              <button type="button" onClick={cancel} disabled={busy} className="rounded-lg border border-border px-4 py-2 text-sm hover:bg-border/40 disabled:opacity-50">
                Keep my account
              </button>
            </div>
          </form>
        )}
      </section>
    </div>
  );
}
