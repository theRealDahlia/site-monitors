"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useState } from "react";
import AlertEmails from "@/components/AlertEmails";
import { ago } from "@/components/monitor-ui";
import Toggle from "@/components/Toggle";
import type { ChannelView } from "@/lib/channels";

type Service = "slack" | "discord";

interface Data {
  allowed: boolean;
  plan: string;
  max: number;
  available: Record<Service, boolean>;
  channels: ChannelView[];
}

const SMALL_BUTTON = "rounded-lg border border-border px-3 py-1.5 text-sm hover:border-accent hover:text-accent disabled:opacity-50 disabled:hover:border-border disabled:hover:text-current";

const SERVICES: { id: Service; name: string; blurb: string; tile: string; letter: string }[] = [
  {
    id: "slack",
    name: "Slack",
    blurb: "Sign in to Slack and we'll create a #site-monitors-alerts channel for your alerts and add you to it.",
    tile: "bg-[#4a154b] text-white",
    letter: "S",
  },
  {
    id: "discord",
    name: "Discord",
    blurb: "Add the Site Monitors bot to your Discord server and we'll create a #site-monitors-alerts channel for your alerts. You need the Manage Server permission.",
    tile: "bg-[#5865f2] text-white",
    letter: "D",
  },
];
const NAME: Record<Service, string> = { slack: "Slack", discord: "Discord" };

/** What the page says after Slack or Discord sends the person back here. */
function resultMessage(params: URLSearchParams, max: number): { ok: boolean; text: string } | null {
  const service = params.get("service");
  const who = service === "slack" || service === "discord" ? NAME[service] : "Slack or Discord";
  if (params.get("connected")) return { ok: true, text: `${who} connected. We posted a message in the channel to show it's working.` };
  switch (params.get("error")) {
    case null:
      return null;
    case "denied":
      return { ok: false, text: `You cancelled on ${who}, so nothing was connected.` };
    case "expired":
      return { ok: false, text: "That connection took too long or didn't start on this page. Try connecting again." };
    case "plan":
      return { ok: false, text: "Slack and Discord alerts are part of the Starter plan." };
    case "not_set_up":
      return { ok: false, text: `${who} isn't set up on Site Monitors yet. Try again later.` };
    case "limit":
      return { ok: false, text: `You can connect up to ${max} channels. Disconnect one to add another.` };
    case "restricted":
      return {
        ok: false,
        text:
          service === "discord"
            ? "Site Monitors isn't allowed to create a channel in that Discord server. Check the bot kept its permissions (Manage Channels, Manage Webhooks), then connect again."
            : "Your Slack workspace doesn't allow apps to create channels. Ask a workspace admin to allow it, then connect again.",
      };
    case "too_many":
      return { ok: false, text: "Too many connection attempts. Try again in a while." };
    default:
      return { ok: false, text: `${who} didn't finish connecting. Try again.` };
  }
}

function ChannelRow({ c, onChanged }: { c: ChannelView; onChanged: (channels?: ChannelView[]) => Promise<void> }) {
  const [busy, setBusy] = useState<"test" | "remove" | "toggle" | null>(null);
  const [confirming, setConfirming] = useState(false);
  const [message, setMessage] = useState<{ ok: boolean; text: string } | null>(null);

  async function call(kind: "test" | "remove" | "toggle", url: string, init: RequestInit, done?: (body: { ok?: boolean; error?: string; channels?: ChannelView[] }) => void) {
    setBusy(kind);
    setMessage(null);
    try {
      const res = await fetch(url, init);
      const body = await res.json();
      if (!res.ok) setMessage({ ok: false, text: body.error ?? "Something went wrong." });
      else done?.(body);
      if (body.channels) await onChanged(body.channels);
    } catch {
      setMessage({ ok: false, text: "Couldn't reach the server. Try again." });
    }
    setBusy(null);
  }

  const test = () =>
    call("test", `/api/integrations/${c.id}/test`, { method: "POST" }, (body) =>
      setMessage(body.ok ? { ok: true, text: `Test message sent. Check ${NAME[c.kind]}.` } : { ok: false, text: body.error ?? "Couldn't send the test message." }),
    );
  const toggle = (enabled: boolean) =>
    call("toggle", `/api/integrations/${c.id}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ enabled }) });
  const remove = () => call("remove", `/api/integrations/${c.id}`, { method: "DELETE" }, () => setConfirming(false));

  const status = !c.enabled
    ? { tone: "text-muted", text: "Off. No alerts are sent here until you switch it back on." }
    : c.lastError
      ? { tone: "text-bad", text: `Last delivery failed: ${c.lastError}` }
      : c.lastOkAt
        ? { tone: "text-ok", text: `Last delivered ${ago(c.lastOkAt)}` }
        : { tone: "text-muted", text: "No alerts sent yet" };

  return (
    <li className="py-4 first:pt-0 last:pb-0">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className={`break-words font-medium ${c.enabled ? "" : "text-muted"}`}>{c.name}</p>
          <p className="mt-0.5 text-xs text-muted">
            {c.via === "manual" ? "Added with a webhook address · " : ""}
            {c.hint}
          </p>
        </div>
        <Toggle on={c.enabled} disabled={busy !== null} label={`Send alerts to ${c.name}`} onChange={toggle} />
      </div>
      <p className={`mt-2 text-sm ${status.tone}`}>{status.text}</p>
      {message && (
        <p role={message.ok ? "status" : "alert"} className={`mt-2 text-sm ${message.ok ? "text-ok" : "text-bad"}`}>
          {message.text}
        </p>
      )}
      <div className="mt-3 flex flex-wrap items-center gap-2">
        {confirming ? (
          <>
            <span className="text-sm text-muted">Disconnect {c.name}?</span>
            <button onClick={remove} disabled={busy === "remove"} className="rounded-lg bg-bad px-3 py-1.5 text-sm font-medium text-background disabled:opacity-50">
              {busy === "remove" ? "Disconnecting…" : "Yes, disconnect"}
            </button>
            <button onClick={() => setConfirming(false)} className={SMALL_BUTTON}>
              Cancel
            </button>
          </>
        ) : (
          <>
            <button onClick={test} disabled={busy !== null || !c.enabled} className={SMALL_BUTTON}>
              {busy === "test" ? "Sending…" : "Send test message"}
            </button>
            <button onClick={() => setConfirming(true)} disabled={busy !== null} className={SMALL_BUTTON}>
              Disconnect
            </button>
          </>
        )}
      </div>
    </li>
  );
}

function ServiceCard({ service, data, onChanged }: { service: (typeof SERVICES)[number]; data: Data; onChanged: (channels?: ChannelView[]) => Promise<void> }) {
  const channels = data.channels.filter((c) => c.kind === service.id);
  const ready = data.available[service.id];
  const full = data.channels.length >= data.max;
  const label = channels.length ? "Add another channel" : `Connect ${service.name}`;

  return (
    <section className="rounded-xl border border-border bg-surface p-5" aria-labelledby={`${service.id}-heading`}>
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="flex min-w-0 flex-1 items-start gap-3">
          <span className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-lg text-lg font-bold ${service.tile}`} aria-hidden>
            {service.letter}
          </span>
          <div className="min-w-0">
            <h2 id={`${service.id}-heading`} className="font-semibold">
              {service.name}
            </h2>
            <p className="mt-0.5 text-sm text-muted">{service.blurb}</p>
          </div>
        </div>
        {!ready ? (
          <span className="rounded-lg border border-border px-4 py-2 text-sm text-muted">Not set up yet</span>
        ) : full ? (
          <span className="rounded-lg border border-border px-4 py-2 text-sm text-muted">{data.max} channel limit reached</span>
        ) : (
          // A plain link, not fetch: the browser goes to Slack or Discord and comes back here.
          <a href={`/api/oauth/${service.id}/start`} className="rounded-lg bg-accent px-4 py-2 text-sm font-medium text-accent-foreground hover:opacity-90">
            {label}
          </a>
        )}
      </div>

      {channels.length > 0 && (
        <ul className="mt-5 divide-y divide-border border-t border-border pt-4">
          {channels.map((c) => (
            <ChannelRow key={c.id} c={c} onChanged={onChanged} />
          ))}
        </ul>
      )}
      {service.id === "discord" && channels.length > 0 && (
        <p className="mt-4 text-xs text-muted">
          Disconnecting stops our messages straight away and deletes the webhook, but keeps the channel and its history in Discord. To remove
          the Site Monitors bot from your server too, remove it in Server Settings → Integrations.
        </p>
      )}
      {service.id === "slack" && channels.length > 0 && (
        <p className="mt-4 text-xs text-muted">
          Disconnecting stops our messages straight away and keeps the channel and its history in Slack. To remove the Site Monitors
          app from your workspace too, open Slack&apos;s Apps settings and remove it there.
        </p>
      )}
    </section>
  );
}

// ---------- the Integrations page ----------

export default function Integrations() {
  const router = useRouter();
  const [data, setData] = useState<Data | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [notice, setNotice] = useState<{ ok: boolean; text: string } | null>(null);

  useEffect(() => {
    let cancelled = false;
    fetch("/api/integrations", { cache: "no-store" })
      .then(async (res) => {
        if (cancelled) return;
        if (res.status === 401) return router.replace("/login?next=%2Fdashboard%2Fintegrations");
        if (!res.ok) return setLoadError("Couldn't load your integrations. Check your connection.");
        const body: Data = await res.json();
        setData(body);
        // Coming back from Slack or Discord: say how it went once, then tidy the address bar.
        const params = new URLSearchParams(window.location.search);
        const result = resultMessage(params, body.max);
        if (result) {
          setNotice(result);
          window.history.replaceState(null, "", window.location.pathname);
        }
      })
      .catch(() => !cancelled && setLoadError("Couldn't load your integrations. Check your connection."));
    return () => {
      cancelled = true;
    };
  }, [router]);

  const refresh = useCallback(async (channels?: ChannelView[]) => {
    if (channels) return setData((d) => (d ? { ...d, channels } : d));
    try {
      const res = await fetch("/api/integrations", { cache: "no-store" });
      if (res.ok) setData(await res.json());
    } catch {
      /* keep what's on screen */
    }
  }, []);

  return (
    <div>
      <h1 className="text-3xl font-semibold tracking-tight">Integrations</h1>
      <p className="mt-2 text-muted">Choose where alerts, and updates whenever you add, edit or remove a site, are sent.</p>

      <div className="mt-6">
        <AlertEmails />
      </div>

      {!data ? (
        loadError ? (
          <p role="alert" className="mt-4 rounded-lg bg-bad-bg px-4 py-3 text-sm text-bad">
            {loadError}
          </p>
        ) : (
          <p className="mt-4 text-muted">Loading Slack and Discord…</p>
        )
      ) : (
        <>
          {notice && (
            <p role={notice.ok ? "status" : "alert"} className={`mt-4 rounded-lg px-4 py-3 text-sm ${notice.ok ? "bg-ok-bg text-ok" : "bg-bad-bg text-bad"}`}>
              {notice.text}
            </p>
          )}

          {!data.allowed ? (
            <section className="mt-4 rounded-xl border border-border bg-surface p-6">
              <h2 className="font-semibold">Slack and Discord alerts are part of the Starter plan</h2>
              <p className="mt-2 text-sm text-muted">
                You&apos;re on the {data.plan} plan. With Starter, every alert we email you (a certificate nearing expiry, a domain about to
                lapse, a site going down or coming back), and every time a site is added, edited or removed, also arrives in the Slack or
                Discord channel you choose.
              </p>
              <Link href="/dashboard/plans" className="mt-4 inline-block rounded-lg border border-border px-4 py-2 text-sm hover:border-accent hover:text-accent">
                See the plans
              </Link>
              {data.channels.length > 0 && (
                <p className="mt-4 text-sm text-muted">Your connected channels are kept, and start receiving alerts again when you&apos;re back on Starter.</p>
              )}
            </section>
          ) : (
            <>
              <div className="mt-4 space-y-4">
                {SERVICES.map((s) => (
                  <ServiceCard key={s.id} service={s} data={data} onChanged={refresh} />
                ))}
              </div>
              <p className="mt-4 text-sm text-muted">
                {data.channels.length} of {data.max} channels connected. Switch a channel off to pause its alerts without disconnecting it.
              </p>
            </>
          )}
        </>
      )}
    </div>
  );
}
