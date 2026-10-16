"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useState } from "react";
import DashboardTabs from "@/components/DashboardTabs";
import { ago } from "@/components/monitor-ui";
import type { ChannelView } from "@/lib/channels";

interface Data {
  allowed: boolean;
  plan: string;
  max: number;
  channels: ChannelView[];
}

const INPUT =
  "w-full rounded-lg border border-border bg-surface px-4 py-3 text-base outline-none placeholder:text-muted/70 focus:border-accent focus:ring-2 focus:ring-accent/30 disabled:opacity-60";
const SMALL_BUTTON = "rounded-lg border border-border px-3 py-1.5 text-sm hover:border-accent hover:text-accent disabled:opacity-50";
const SERVICE = { slack: "Slack", discord: "Discord" } as const;

const HELP = {
  slack: "In Slack, create an app at api.slack.com/apps, turn on Incoming Webhooks, add one to the channel you want, and copy its URL.",
  discord: "In Discord, open Server Settings → Integrations → Webhooks → New Webhook, choose the channel, and copy the Webhook URL.",
} as const;

function ChannelRow({ c, onChanged }: { c: ChannelView; onChanged: (channels?: ChannelView[]) => Promise<void> }) {
  const [busy, setBusy] = useState<"test" | "remove" | null>(null);
  const [confirming, setConfirming] = useState(false);
  const [message, setMessage] = useState<{ ok: boolean; text: string } | null>(null);

  async function test() {
    setBusy("test");
    setMessage(null);
    try {
      const res = await fetch(`/api/integrations/${c.id}/test`, { method: "POST" });
      const body = await res.json();
      if (res.ok && body.ok) setMessage({ ok: true, text: `Test message sent. Check ${SERVICE[c.kind]}.` });
      else setMessage({ ok: false, text: body.error ?? "Couldn't send the test message." });
      await onChanged(body.channels);
    } catch {
      setMessage({ ok: false, text: "Couldn't reach the server. Try again." });
    }
    setBusy(null);
  }

  async function remove() {
    setBusy("remove");
    try {
      const res = await fetch(`/api/integrations/${c.id}`, { method: "DELETE" });
      if (res.ok) await onChanged();
      else setMessage({ ok: false, text: (await res.json()).error ?? "Couldn't remove it." });
    } catch {
      setMessage({ ok: false, text: "Couldn't reach the server. Try again." });
    }
    setBusy(null);
    setConfirming(false);
  }

  const status = c.lastError
    ? { tone: "text-bad", text: `Last delivery failed: ${c.lastError}` }
    : c.lastOkAt
      ? { tone: "text-ok", text: `Last delivered ${ago(c.lastOkAt)}` }
      : { tone: "text-muted", text: "No alerts sent yet" };

  return (
    <li className="rounded-xl border border-border bg-surface p-4 sm:p-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="min-w-0">
          <p className="break-words font-semibold">{c.name}</p>
          <p className="mt-0.5 text-xs text-muted">
            {SERVICE[c.kind]} · {c.hint}
          </p>
        </div>
        <span className="rounded-full border border-border px-2.5 py-0.5 text-xs text-muted">{SERVICE[c.kind]}</span>
      </div>
      <p className={`mt-3 text-sm ${status.tone}`}>{status.text}</p>
      {message && (
        <p role={message.ok ? "status" : "alert"} className={`mt-2 text-sm ${message.ok ? "text-ok" : "text-bad"}`}>
          {message.text}
        </p>
      )}
      <div className="mt-3 flex flex-wrap items-center gap-2 border-t border-border pt-3">
        {confirming ? (
          <>
            <span className="text-sm text-muted">Stop sending alerts to {c.name}?</span>
            <button onClick={remove} disabled={busy === "remove"} className="rounded-lg bg-bad px-3 py-1.5 text-sm font-medium text-background disabled:opacity-50">
              {busy === "remove" ? "Removing…" : "Yes, remove"}
            </button>
            <button onClick={() => setConfirming(false)} className={SMALL_BUTTON}>
              Cancel
            </button>
          </>
        ) : (
          <>
            <button onClick={test} disabled={busy !== null} className={SMALL_BUTTON}>
              {busy === "test" ? "Sending…" : "Send test message"}
            </button>
            <button onClick={() => setConfirming(true)} disabled={busy !== null} className={SMALL_BUTTON}>
              Remove
            </button>
          </>
        )}
      </div>
    </li>
  );
}

// ---------- the Integrations tab ----------

export default function Integrations() {
  const router = useRouter();
  const [data, setData] = useState<Data | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [kind, setKind] = useState<"slack" | "discord">("slack");
  const [name, setName] = useState("");
  const [url, setUrl] = useState("");
  const [adding, setAdding] = useState(false);
  const [addError, setAddError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  const apply = useCallback(
    (result: { kind: "ok"; data: Data } | { kind: "unauthorized" } | { kind: "error" }) => {
      if (result.kind === "unauthorized") router.replace("/login?next=%2Fdashboard%2Fintegrations");
      else if (result.kind === "ok") {
        setData(result.data);
        setLoadError(null);
      } else setLoadError("Couldn't load your integrations. Check your connection.");
    },
    [router],
  );

  useEffect(() => {
    let cancelled = false;
    fetch("/api/integrations")
      .then(async (res): Promise<Parameters<typeof apply>[0]> => (res.status === 401 ? { kind: "unauthorized" } : res.ok ? { kind: "ok", data: await res.json() } : { kind: "error" }))
      .catch((): Parameters<typeof apply>[0] => ({ kind: "error" }))
      .then((r) => !cancelled && apply(r));
    return () => {
      cancelled = true;
    };
  }, [apply]);

  const refresh = useCallback(async (channels?: ChannelView[]) => {
    if (channels) return setData((d) => (d ? { ...d, channels } : d));
    try {
      const res = await fetch("/api/integrations");
      if (res.ok) setData(await res.json());
    } catch {
      /* keep what's on screen */
    }
  }, []);

  async function add(e: React.FormEvent) {
    e.preventDefault();
    if (adding) return;
    setAdding(true);
    setAddError(null);
    setNotice(null);
    try {
      const res = await fetch("/api/integrations", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ kind, name, url }),
      });
      const body = await res.json();
      if (!res.ok) setAddError(body.error ?? "Something went wrong.");
      else {
        setName("");
        setUrl("");
        setNotice(`${SERVICE[kind]} connected. We sent a test message to confirm it works.`);
        await refresh(body.channels);
      }
    } catch {
      setAddError("Couldn't reach the server. Try again.");
    }
    setAdding(false);
  }

  if (!data) {
    return loadError ? (
      <p role="alert" className="rounded-lg bg-bad-bg px-4 py-3 text-sm text-bad">
        {loadError}
      </p>
    ) : (
      <p className="text-muted">Loading your integrations…</p>
    );
  }

  return (
    <div>
      <h1 className="text-3xl font-semibold tracking-tight">Dashboard</h1>
      <p className="mt-2 text-muted">Send alerts, and updates whenever you add, edit or remove a site, to Slack or Discord as well as email.</p>

      <DashboardTabs />

      {!data.allowed ? (
        <section className="mt-6 rounded-xl border border-border bg-surface p-6">
          <h2 className="font-semibold">Slack and Discord alerts are part of the Starter plan</h2>
          <p className="mt-2 text-sm text-muted">
            You&apos;re on the {data.plan} plan. With Starter, every alert we email you (a certificate nearing expiry, a domain
            about to lapse, a site going down or coming back), and every time a site is added, edited or removed, also arrives in the Slack
            or Discord channel you choose.
          </p>
          <p className="mt-3 text-sm text-muted">
            The Starter plan isn&apos;t available to buy yet.{" "}
            <Link href="/pricing" className="text-accent underline underline-offset-2">
              See the plans
            </Link>
            .
          </p>
        </section>
      ) : (
        <>
          <section className="mt-6 rounded-xl border border-border bg-surface p-5">
            <div className="flex flex-wrap items-baseline justify-between gap-2">
              <h2 className="font-semibold">Connect a channel</h2>
              <p className="text-sm text-muted">
                {data.channels.length} of {data.max} channels
              </p>
            </div>
            <form onSubmit={add} className="mt-4 space-y-4">
              <fieldset>
                <legend className="mb-1.5 text-sm font-medium">Service</legend>
                <div className="flex gap-2">
                  {(["slack", "discord"] as const).map((k) => (
                    <label
                      key={k}
                      className={`cursor-pointer rounded-lg border px-4 py-2 text-sm ${kind === k ? "border-accent bg-accent/10 text-foreground" : "border-border text-muted"}`}
                    >
                      <input type="radio" name="kind" value={k} checked={kind === k} onChange={() => setKind(k)} className="sr-only" />
                      {SERVICE[k]}
                    </label>
                  ))}
                </div>
              </fieldset>
              <div>
                <label htmlFor="channel-name" className="mb-1.5 block text-sm font-medium">
                  Name
                </label>
                <input id="channel-name" value={name} onChange={(e) => setName(e.target.value)} maxLength={40} required placeholder="#alerts" className={INPUT} disabled={adding} />
              </div>
              <div>
                <label htmlFor="channel-url" className="mb-1.5 block text-sm font-medium">
                  Webhook URL
                </label>
                <input
                  id="channel-url"
                  type="password"
                  autoComplete="off"
                  spellCheck={false}
                  value={url}
                  onChange={(e) => setUrl(e.target.value)}
                  required
                  placeholder={kind === "slack" ? "https://hooks.slack.com/services/…" : "https://discord.com/api/webhooks/…"}
                  className={INPUT}
                  disabled={adding}
                />
                <p className="mt-1.5 text-xs text-muted">{HELP[kind]}</p>
                <p className="mt-1 text-xs text-muted">Treat this URL like a password. We store it encrypted and only ever show its last few characters.</p>
              </div>
              {addError && (
                <p role="alert" className="rounded-lg bg-bad-bg px-4 py-3 text-sm text-bad">
                  {addError}
                </p>
              )}
              <button
                type="submit"
                disabled={adding || data.channels.length >= data.max}
                className="rounded-lg bg-accent px-6 py-3 text-base font-medium text-accent-foreground hover:opacity-90 disabled:opacity-50"
              >
                {adding ? "Sending a test message…" : "Connect"}
              </button>
              <p className="text-xs text-muted">We post a test message to confirm it works, and only save the channel if it does.</p>
            </form>
          </section>

          {notice && (
            <p role="status" className="mt-4 rounded-lg bg-ok-bg px-4 py-3 text-sm text-ok">
              {notice}
            </p>
          )}

          <section className="mt-8" aria-labelledby="channels-heading">
            <h2 id="channels-heading" className="font-semibold">
              Your channels
            </h2>
            {data.channels.length === 0 ? (
              <p className="mt-3 rounded-xl border border-dashed border-border p-6 text-center text-sm text-muted">
                No channels yet. Connect one above and your alerts will arrive there too.
              </p>
            ) : (
              <ul className="mt-3 space-y-3">
                {data.channels.map((c) => (
                  <ChannelRow key={c.id} c={c} onChanged={refresh} />
                ))}
              </ul>
            )}
          </section>
        </>
      )}
    </div>
  );
}
