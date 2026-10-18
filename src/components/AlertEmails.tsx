"use client";

import { useEffect, useState } from "react";
import { ago } from "@/components/monitor-ui";
import Toggle from "@/components/Toggle";
import type { Recipients } from "@/lib/alert-emails";

type Data = Recipients & { max: number };

const INPUT =
  "w-full min-w-0 flex-1 rounded-lg border border-border bg-surface px-3 py-2 text-sm outline-none placeholder:text-muted/70 focus:border-accent focus:ring-2 focus:ring-accent/30 disabled:opacity-60";
const SMALL_BUTTON = "rounded-lg border border-border px-3 py-1.5 text-sm hover:border-accent hover:text-accent disabled:opacity-50";

/** The Email card on the Integrations page: which addresses alert emails go to. Every plan has it. */
export default function AlertEmails() {
  const [data, setData] = useState<Data | null>(null);
  const [failed, setFailed] = useState(false);
  const [email, setEmail] = useState("");
  const [busy, setBusy] = useState<string | null>(null);
  const [message, setMessage] = useState<{ ok: boolean; text: string } | null>(null);

  useEffect(() => {
    let cancelled = false;
    fetch("/api/alert-emails", { cache: "no-store" })
      .then(async (res) => {
        if (cancelled) return;
        if (res.ok) setData(await res.json());
        else setFailed(true);
      })
      .catch(() => !cancelled && setFailed(true));
    return () => {
      cancelled = true;
    };
  }, []);

  /** Runs one change and shows the updated list, or what went wrong. */
  async function call(key: string, url: string, init: RequestInit, success?: string): Promise<boolean> {
    setBusy(key);
    setMessage(null);
    let ok = false;
    try {
      const res = await fetch(url, init);
      const body = await res.json();
      if (res.ok) {
        setData(body);
        ok = true;
        if (success) setMessage({ ok: true, text: success });
      } else setMessage({ ok: false, text: body.error ?? "Something went wrong." });
    } catch {
      setMessage({ ok: false, text: "Couldn't reach the server. Try again." });
    }
    setBusy(null);
    return ok;
  }

  const json = (method: string, body?: unknown): RequestInit => ({
    method,
    headers: { "Content-Type": "application/json" },
    body: body === undefined ? undefined : JSON.stringify(body),
  });

  async function add(e: React.FormEvent) {
    e.preventDefault();
    const address = email.trim();
    if (!address || busy) return;
    if (await call("add", "/api/alert-emails", json("POST", { email: address }), `We sent a confirmation link to ${address}. It gets alerts once that link is used.`)) {
      setEmail("");
    }
  }

  const toggle = (id: number | "account", enabled: boolean) => call(`toggle-${id}`, `/api/alert-emails/${id}`, json("PATCH", { enabled }));
  const resend = (id: number, address: string) => call(`resend-${id}`, `/api/alert-emails/${id}/resend`, json("POST"), `Sent a new confirmation link to ${address}.`);
  const remove = (id: number) => call(`remove-${id}`, `/api/alert-emails/${id}`, json("DELETE"));

  const anyOn = data ? data.account.enabled || data.extras.some((e) => e.enabled && e.confirmed) : true;

  return (
    <section className="rounded-xl border border-border bg-surface p-5" aria-labelledby="email-heading">
      <div className="flex items-start gap-3">
        <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-accent text-accent-foreground" aria-hidden>
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.75} strokeLinecap="round" strokeLinejoin="round" className="h-5 w-5">
            <path d="M3 6h18v12H3zM3 7l9 6 9-6" />
          </svg>
        </span>
        <div className="min-w-0">
          <h2 id="email-heading" className="font-semibold">
            Email
          </h2>
          <p className="mt-0.5 text-sm text-muted">Alerts and updates about your sites go to every address that&apos;s switched on.</p>
        </div>
      </div>

      {!data ? (
        <p className={`mt-4 text-sm ${failed ? "text-bad" : "text-muted"}`}>{failed ? "Couldn't load your email addresses." : "Loading…"}</p>
      ) : (
        <>
          <ul className="mt-5 divide-y divide-border border-t border-border">
            <li className="flex items-center justify-between gap-3 py-3">
              <div className="min-w-0">
                <p className="break-all font-medium">{data.account.email}</p>
                <p className="text-xs text-muted">Your account&apos;s email</p>
              </div>
              <Toggle
                on={data.account.enabled}
                disabled={busy !== null}
                label={`Send alerts to ${data.account.email}`}
                onChange={(on) => toggle("account", on)}
              />
            </li>
            {data.extras.map((e) => (
              <li key={e.id} className="py-3">
                <div className="flex items-center justify-between gap-3">
                  <div className="min-w-0">
                    <p className={`break-all font-medium ${e.confirmed ? "" : "text-muted"}`}>{e.email}</p>
                    <p className={`text-xs ${e.confirmed ? "text-muted" : "text-warn"}`}>
                      {e.confirmed ? "Confirmed" : `Waiting for confirmation${e.confirmSentAt ? `, link sent ${ago(e.confirmSentAt)}` : ""}`}
                    </p>
                  </div>
                  <Toggle
                    on={e.enabled && e.confirmed}
                    disabled={busy !== null || !e.confirmed}
                    label={`Send alerts to ${e.email}`}
                    onChange={(on) => toggle(e.id, on)}
                  />
                </div>
                <div className="mt-2 flex flex-wrap gap-2">
                  {!e.confirmed && (
                    <button type="button" onClick={() => resend(e.id, e.email)} disabled={busy !== null} className={SMALL_BUTTON}>
                      {busy === `resend-${e.id}` ? "Sending…" : "Resend link"}
                    </button>
                  )}
                  <button type="button" onClick={() => remove(e.id)} disabled={busy !== null} className={SMALL_BUTTON}>
                    {busy === `remove-${e.id}` ? "Removing…" : "Remove"}
                  </button>
                </div>
              </li>
            ))}
          </ul>

          {!anyOn && (
            <p role="alert" className="mt-2 rounded-lg bg-warn-bg px-4 py-3 text-sm text-warn">
              Every address is switched off, so alerts won&apos;t be emailed. You&apos;ll still see them on the Notifications page.
            </p>
          )}

          {data.extras.length < data.max ? (
            <form onSubmit={add} className="mt-4 border-t border-border pt-4">
              <label htmlFor="alert-email" className="text-sm font-medium">
                Add an address
              </label>
              <div className="mt-1.5 flex flex-wrap gap-2">
                <input
                  id="alert-email"
                  type="email"
                  autoComplete="off"
                  value={email}
                  onChange={(ev) => setEmail(ev.target.value)}
                  placeholder="colleague@example.com"
                  maxLength={254}
                  required
                  disabled={busy !== null}
                  className={INPUT}
                />
                <button
                  type="submit"
                  disabled={busy !== null}
                  className="rounded-lg bg-accent px-4 py-2 text-sm font-medium text-accent-foreground hover:opacity-90 disabled:opacity-50"
                >
                  {busy === "add" ? "Sending link…" : "Add email"}
                </button>
              </div>
              <p className="mt-1.5 text-xs text-muted">
                {data.extras.length} of {data.max} extra addresses. We email each one a link to confirm, and it only gets alerts after that.
              </p>
            </form>
          ) : (
            <p className="mt-4 border-t border-border pt-4 text-sm text-muted">
              {data.extras.length > data.max
                ? `Your plan includes ${data.max} extra addresses and you have ${data.extras.length}. They all keep working. Remove ${data.extras.length - data.max} to add another.`
                : `You've used all ${data.max} extra addresses on your plan. Remove one to add another.`}
            </p>
          )}

          {message && (
            <p role={message.ok ? "status" : "alert"} className={`mt-3 text-sm ${message.ok ? "text-ok" : "text-bad"}`}>
              {message.text}
            </p>
          )}
        </>
      )}
    </section>
  );
}
