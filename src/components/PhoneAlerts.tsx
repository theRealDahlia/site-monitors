"use client";

import Link from "next/link";
import { useEffect, useState } from "react";

interface Phone {
  id: number;
  number: string;
  label: string;
  mode: "sms" | "call" | "both";
  verified: boolean;
}

interface Data {
  allowed: boolean;
  configured: boolean;
  max: number;
  limits: { sms: number; calls: number };
  used: { sms: number; calls: number };
  phones: Phone[];
}

const FIELD = "min-w-0 rounded-lg border border-border bg-background px-3 py-2 text-sm outline-none placeholder:text-muted/70 focus:border-accent focus:ring-2 focus:ring-accent/30 disabled:opacity-60";
const SMALL = "rounded-lg border border-border px-3 py-1.5 text-sm hover:border-accent hover:text-accent disabled:opacity-50";
const MODES = [
  ["sms", "Text"],
  ["call", "Call"],
  ["both", "Text and call"],
] as const;

async function call(url: string, method: string, body?: unknown): Promise<{ ok: boolean; data: Record<string, unknown> }> {
  try {
    const res = await fetch(url, { method, headers: body ? { "Content-Type": "application/json" } : undefined, body: body ? JSON.stringify(body) : undefined });
    return { ok: res.ok, data: await res.json() };
  } catch {
    return { ok: false, data: { error: "Couldn't reach the server. Try again." } };
  }
}

function PhoneRow({ p, onChanged, setStatus }: { p: Phone; onChanged: () => Promise<void>; setStatus: (s: { ok: boolean; text: string } | null) => void }) {
  const [code, setCode] = useState("");
  const [busy, setBusy] = useState<string | null>(null);

  async function act(what: string, url: string, method: string, body?: unknown, done?: string) {
    setBusy(what);
    setStatus(null);
    const r = await call(url, method, body);
    if (!r.ok) setStatus({ ok: false, text: (r.data.error as string) ?? "Something went wrong." });
    else {
      if (done) setStatus({ ok: true, text: done });
      await onChanged();
    }
    setBusy(null);
  }

  return (
    <li className="py-3">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="min-w-0">
          <p className="font-medium">{p.label}</p>
          <p className="text-sm text-muted">
            {p.number}
            {!p.verified && <span className="ml-2 text-warn">not confirmed yet</span>}
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {p.verified && (
            <>
              <label htmlFor={`mode-${p.id}`} className="sr-only">
                How to alert {p.label}
              </label>
              <select id={`mode-${p.id}`} value={p.mode} disabled={busy !== null} onChange={(e) => act("mode", `/api/phones/${p.id}`, "PATCH", { mode: e.target.value })} className={FIELD}>
                {MODES.map(([id, label]) => (
                  <option key={id} value={id}>
                    {label}
                  </option>
                ))}
              </select>
              <button type="button" className={SMALL} disabled={busy !== null} onClick={() => act("test", `/api/phones/${p.id}/test`, "POST", undefined, `Test sent to ${p.label}.`)}>
                {busy === "test" ? "Sending…" : "Send a test"}
              </button>
            </>
          )}
          <button type="button" className={SMALL} disabled={busy !== null} onClick={() => act("remove", `/api/phones/${p.id}`, "DELETE")}>
            {busy === "remove" ? "Removing…" : "Remove"}
          </button>
        </div>
      </div>
      {!p.verified && (
        <form
          className="mt-2 flex flex-wrap items-center gap-2"
          onSubmit={(e) => {
            e.preventDefault();
            act("verify", `/api/phones/${p.id}/verify`, "POST", { code }, `${p.label} is confirmed. It'll get outage alerts.`);
          }}
        >
          <label htmlFor={`code-${p.id}`} className="text-sm text-muted">
            Code we texted:
          </label>
          <input id={`code-${p.id}`} inputMode="numeric" autoComplete="one-time-code" maxLength={6} value={code} onChange={(e) => setCode(e.target.value.replace(/\D/g, ""))} className={`${FIELD} w-28`} disabled={busy !== null} />
          <button type="submit" className={SMALL} disabled={busy !== null || code.length !== 6}>
            {busy === "verify" ? "Checking…" : "Confirm"}
          </button>
          <button type="button" className="text-sm text-accent underline underline-offset-2 disabled:opacity-50" disabled={busy !== null} onClick={() => act("resend", `/api/phones/${p.id}/code`, "POST", undefined, "We've texted a new code.")}>
            Send a new code
          </button>
        </form>
      )}
    </li>
  );
}

/** Phone numbers for outage alerts by text or call (Pro), on the Integrations page. */
export default function PhoneAlerts() {
  const [data, setData] = useState<Data | null>(null);
  const [number, setNumber] = useState("");
  const [label, setLabel] = useState("");
  const [mode, setMode] = useState<Phone["mode"]>("sms");
  const [busy, setBusy] = useState(false);
  const [status, setStatus] = useState<{ ok: boolean; text: string } | null>(null);

  const load = async () => {
    const r = await call("/api/phones", "GET");
    if (r.ok) setData(r.data as unknown as Data);
  };

  useEffect(() => {
    let cancelled = false;
    call("/api/phones", "GET").then((r) => r.ok && !cancelled && setData(r.data as unknown as Data));
    return () => {
      cancelled = true;
    };
  }, []);

  async function add(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setStatus(null);
    const r = await call("/api/phones", "POST", { number, label, mode });
    if (!r.ok) setStatus({ ok: false, text: (r.data.error as string) ?? "Something went wrong." });
    else {
      setNumber("");
      setLabel("");
      setStatus({ ok: true, text: "We've texted a code to that number. Type it in below to confirm it." });
      await load();
    }
    setBusy(false);
  }

  if (!data) return null;

  return (
    <section className="mt-4 rounded-xl border border-border bg-surface p-5" aria-labelledby="phones-heading">
      <h2 id="phones-heading" className="flex flex-wrap items-center gap-2 font-semibold">
        Text and call alerts
        {!data.allowed && <span className="rounded-full border border-border px-2 py-0.5 text-xs font-medium text-muted">Pro</span>}
      </h2>
      <p className="mt-0.5 text-sm text-muted">
        Get a text or a phone call when a monitor goes down and when it&apos;s back. Phones only get outage alerts, not expiry warnings.
      </p>

      {!data.allowed ? (
        <p className="mt-3 text-sm text-muted">
          Text and call alerts are part of the Pro plan.{" "}
          <Link href="/dashboard/plans" className="text-accent underline underline-offset-2">
            See the plans
          </Link>
          .
        </p>
      ) : !data.configured ? (
        <p className="mt-3 text-sm text-muted">Text messages aren&apos;t set up on this server yet.</p>
      ) : (
        <>
          <p className="mt-2 text-xs text-muted">
            This month: {data.used.sms} of {data.limits.sms} texts and {data.used.calls} of {data.limits.calls} calls used. Past the limit, outage alerts still arrive by email.
          </p>
          {data.phones.length > 0 && (
            <ul className="mt-2 divide-y divide-border border-t border-border">
              {data.phones.map((p) => (
                <PhoneRow key={p.id} p={p} onChanged={load} setStatus={setStatus} />
              ))}
            </ul>
          )}
          {data.phones.length < data.max && (
            <form onSubmit={add} className="mt-3 grid gap-2 sm:grid-cols-[1fr_1fr_auto_auto]">
              <label htmlFor="phone-number" className="sr-only">
                Phone number
              </label>
              <input id="phone-number" type="tel" autoComplete="tel" placeholder="+44 7700 900123" value={number} onChange={(e) => setNumber(e.target.value)} className={FIELD} disabled={busy} />
              <label htmlFor="phone-label" className="sr-only">
                Name
              </label>
              <input id="phone-label" placeholder="Name, like On-call" maxLength={40} value={label} onChange={(e) => setLabel(e.target.value)} className={FIELD} disabled={busy} />
              <label htmlFor="phone-mode" className="sr-only">
                Text or call
              </label>
              <select id="phone-mode" value={mode} onChange={(e) => setMode(e.target.value as Phone["mode"])} className={FIELD} disabled={busy}>
                {MODES.map(([id, l]) => (
                  <option key={id} value={id}>
                    {l}
                  </option>
                ))}
              </select>
              <button type="submit" disabled={busy || !number.trim()} className="rounded-lg bg-accent px-4 py-2 text-sm font-medium text-accent-foreground hover:opacity-90 disabled:opacity-50">
                {busy ? "Sending code…" : "Add number"}
              </button>
            </form>
          )}
        </>
      )}
      {status && (
        <p role={status.ok ? "status" : "alert"} className={`mt-2 text-sm ${status.ok ? "text-ok" : "text-bad"}`}>
          {status.text}
        </p>
      )}
    </section>
  );
}
