"use client";

import Link from "next/link";
import { useEffect, useState } from "react";

type Data =
  | { role: "member"; ownerEmail: string }
  | { role: "owner"; seats: number; members: { userId: number; email: string; joinedAt: number }[]; invites: { id: number; email: string; expiresAt: number }[] };

const SMALL = "shrink-0 rounded-md border border-border px-2.5 py-1 text-xs hover:border-accent hover:text-accent disabled:opacity-50";

/** The Team page: the owner invites and removes people; a member sees whose account they're in, and can leave. */
export default function Team() {
  const [data, setData] = useState<Data | null>(null);
  const [email, setEmail] = useState("");
  const [busy, setBusy] = useState<string | null>(null);
  const [status, setStatus] = useState<{ ok: boolean; text: string } | null>(null);

  const load = async () => {
    const r = await fetch("/api/team", { cache: "no-store" });
    if (r.ok) setData(await r.json());
  };
  useEffect(() => {
    let cancelled = false;
    fetch("/api/team", { cache: "no-store" })
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => d && !cancelled && setData(d))
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, []);

  async function act(what: string, url: string, method: string, body?: unknown, done?: string, after?: () => void) {
    setBusy(what);
    setStatus(null);
    try {
      const res = await fetch(url, { method, headers: body ? { "Content-Type": "application/json" } : undefined, body: body ? JSON.stringify(body) : undefined });
      if (!res.ok) setStatus({ ok: false, text: (await res.json()).error ?? "Something went wrong." });
      else {
        if (done) setStatus({ ok: true, text: done });
        after?.();
        await load();
      }
    } catch {
      setStatus({ ok: false, text: "Couldn't reach the server. Try again." });
    }
    setBusy(null);
  }

  if (!data) return <p className="text-muted">Loading…</p>;

  if (data.role === "member") {
    return (
      <div>
        <h1 className="text-3xl font-semibold tracking-tight">Team</h1>
        <section className="mt-6 rounded-xl border border-border bg-surface p-5">
          <p>
            You&apos;re working in <span className="font-medium">{data.ownerEmail}</span>&apos;s account. Everything you see and change here is theirs.
          </p>
          <p className="mt-2 text-sm text-muted">Leaving takes you back to your own account. Your own monitors, if you had any, have kept running.</p>
          <button
            type="button"
            className="mt-4 rounded-lg border border-border px-4 py-2 text-sm hover:border-bad hover:text-bad disabled:opacity-50"
            disabled={busy !== null}
            // A full reload on purpose: the whole app now belongs to a different account.
            // eslint-disable-next-line @next/next/no-location-assign-relative-destination
            onClick={() => act("leave", "/api/team/leave", "POST", undefined, undefined, () => window.location.assign("/dashboard"))}
          >
            {busy === "leave" ? "Leaving…" : "Leave the team"}
          </button>
        </section>
        {status && <p className={`mt-3 text-sm ${status.ok ? "text-ok" : "text-bad"}`}>{status.text}</p>}
      </div>
    );
  }

  const used = data.members.length + data.invites.length;
  return (
    <div>
      <h1 className="flex flex-wrap items-center gap-3 text-3xl font-semibold tracking-tight">
        Team
        {data.seats === 0 && <span className="rounded-full border border-border px-2.5 py-0.5 text-sm font-medium text-muted">Pro</span>}
      </h1>
      <p className="mt-2 text-muted">Invite people to work in this account with their own login: the same monitors, alerts and settings. Only you can manage the team.</p>

      {data.seats === 0 ? (
        <section className="mt-6 rounded-xl border border-border bg-surface p-5">
          <h2 className="font-semibold">Part of the Pro plan</h2>
          <p className="mt-1 text-sm text-muted">Pro includes 3 people besides you, each with their own login.</p>
          <Link href="/dashboard/plans" className="mt-4 inline-block rounded-lg bg-accent px-4 py-2 text-sm font-medium text-accent-foreground hover:opacity-90">
            See the plans
          </Link>
        </section>
      ) : (
        <section className="mt-6 rounded-xl border border-border bg-surface p-5">
          <div className="flex flex-wrap items-baseline justify-between gap-2">
            <h2 className="font-semibold">People</h2>
            <p className="text-sm text-muted">
              {used} of {data.seats} places used
            </p>
          </div>
          <ul className="mt-2 divide-y divide-border text-sm">
            {data.members.map((m) => (
              <li key={m.userId} className="flex items-center justify-between gap-3 py-2">
                <span className="min-w-0 truncate">{m.email}</span>
                <button type="button" className={SMALL} disabled={busy !== null} onClick={() => act(`m${m.userId}`, `/api/team/members/${m.userId}`, "DELETE", undefined, `${m.email} was removed.`)}>
                  Remove
                </button>
              </li>
            ))}
            {data.invites.map((i) => (
              <li key={i.id} className="flex items-center justify-between gap-3 py-2">
                <span className="min-w-0 truncate">
                  {i.email} <span className="text-xs text-warn">invited, hasn&apos;t joined yet</span>
                </span>
                <button type="button" className={SMALL} disabled={busy !== null} onClick={() => act(`i${i.id}`, `/api/team/invites/${i.id}`, "DELETE", undefined, "Invitation withdrawn.")}>
                  Withdraw
                </button>
              </li>
            ))}
          </ul>
          {used < data.seats && (
            <form
              className="mt-3 flex flex-col gap-2 sm:flex-row"
              onSubmit={(e) => {
                e.preventDefault();
                act("invite", "/api/team/invites", "POST", { email }, `We've emailed ${email} an invitation.`, () => setEmail(""));
              }}
            >
              <label htmlFor="team-email" className="sr-only">
                Email address
              </label>
              <input
                id="team-email"
                type="email"
                placeholder="colleague@example.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                disabled={busy !== null}
                className="min-w-0 flex-1 rounded-lg border border-border bg-background px-3 py-2 text-sm outline-none focus:border-accent focus:ring-2 focus:ring-accent/30"
              />
              <button type="submit" disabled={busy !== null || !email.trim()} className="rounded-lg bg-accent px-4 py-2 text-sm font-medium text-accent-foreground hover:opacity-90 disabled:opacity-50">
                {busy === "invite" ? "Sending…" : "Invite"}
              </button>
            </form>
          )}
        </section>
      )}
      {status && (
        <p role={status.ok ? "status" : "alert"} className={`mt-3 text-sm ${status.ok ? "text-ok" : "text-bad"}`}>
          {status.text}
        </p>
      )}
    </div>
  );
}
