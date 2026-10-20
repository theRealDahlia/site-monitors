"use client";

import Link from "next/link";
import { useEffect, useState } from "react";

/** Accepting a team invitation: say who it's from, then join as the person signed in. */
export default function JoinTeam() {
  const [token] = useState(() => (typeof window === "undefined" ? "" : (new URLSearchParams(window.location.search).get("token") ?? "")));
  const [invite, setInvite] = useState<{ ownerEmail: string; email: string } | null | "missing">(null);
  const [me, setMe] = useState<{ email: string } | null | undefined>(undefined);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    Promise.all([
      fetch(`/api/team/invite-info?token=${encodeURIComponent(token)}`).then((r) => (r.ok ? r.json() : "missing")),
      fetch("/api/auth/me", { cache: "no-store" }).then((r) => r.json()),
    ])
      .then(([i, m]) => {
        if (cancelled) return;
        setInvite(i);
        setMe(m.user ? { email: m.user.email } : null);
      })
      .catch(() => !cancelled && setInvite("missing"));
    return () => {
      cancelled = true;
    };
  }, [token]);

  async function join() {
    setBusy(true);
    setError(null);
    try {
      const res = await fetch("/api/team/join", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ token }) });
      // A full reload on purpose: the whole app now belongs to a different account.
      // eslint-disable-next-line @next/next/no-location-assign-relative-destination
      if (res.ok) window.location.assign("/dashboard");
      else setError((await res.json()).error ?? "Something went wrong.");
    } catch {
      setError("Couldn't reach the server. Try again.");
    }
    setBusy(false);
  }

  if (invite === null || me === undefined) return <p className="text-muted">Loading…</p>;
  if (invite === "missing") {
    return (
      <>
        <h1 className="text-3xl font-semibold tracking-tight">Invitation expired</h1>
        <p className="mt-3 text-muted">This invitation has expired or was withdrawn. Ask whoever invited you to send a new one.</p>
      </>
    );
  }

  const back = `/join?token=${encodeURIComponent(token)}`;
  return (
    <>
      <h1 className="text-3xl font-semibold tracking-tight">Join {invite.ownerEmail}&apos;s account</h1>
      <p className="mt-3 text-muted">
        You&apos;ll see and manage their monitors, alerts and settings, signed in as yourself. They can remove you, and you can leave, at any time.
      </p>
      {!me ? (
        <>
          <p className="mt-6 text-sm">
            The invitation is for <span className="font-medium">{invite.email}</span>. Sign in with that address, or create a login for it.
          </p>
          <div className="mt-4 flex flex-wrap gap-2">
            <Link href={`/login?next=${encodeURIComponent(back)}`} className="rounded-lg bg-accent px-4 py-2 text-sm font-medium text-accent-foreground hover:opacity-90">
              Log in
            </Link>
            <Link href={`/signup?next=${encodeURIComponent(back)}`} className="rounded-lg border border-border px-4 py-2 text-sm hover:border-accent hover:text-accent">
              Create a login
            </Link>
          </div>
        </>
      ) : me.email !== invite.email ? (
        <p role="alert" className="mt-6 rounded-lg bg-warn-bg px-4 py-3 text-sm text-warn">
          You&apos;re signed in as {me.email}, but this invitation is for {invite.email}. Log out and sign in with that address to accept it.
        </p>
      ) : (
        <button type="button" onClick={join} disabled={busy} className="mt-6 rounded-lg bg-accent px-5 py-2.5 text-sm font-medium text-accent-foreground hover:opacity-90 disabled:opacity-50">
          {busy ? "Joining…" : "Join the team"}
        </button>
      )}
      {error && (
        <p role="alert" className="mt-3 rounded-lg bg-bad-bg px-4 py-3 text-sm text-bad">
          {error}
        </p>
      )}
    </>
  );
}
