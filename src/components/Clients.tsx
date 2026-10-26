"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import CustomDomainPanel from "@/components/CustomDomainPanel";
import { useAutoClear } from "@/components/monitor-ui";
import type { clientView } from "@/lib/clients";
import { ACCENTS, BRAND_NAME_MAX } from "@/lib/theme";

type Client = ReturnType<typeof clientView>;

const FIELD = "w-full min-w-0 rounded-lg border border-border bg-background px-3 py-2 text-sm outline-none placeholder:text-muted/70 focus:border-accent focus:ring-2 focus:ring-accent/30 disabled:opacity-60";
const SMALL = "rounded-lg border border-border px-3 py-1.5 text-sm hover:border-accent hover:text-accent disabled:opacity-50";
const PRIMARY = "rounded-lg bg-accent px-4 py-2 text-sm font-medium text-accent-foreground hover:opacity-90 disabled:opacity-50";
const FILLED = "rounded-lg bg-accent px-4 py-1.5 text-sm font-medium text-accent-foreground hover:opacity-90 disabled:opacity-50";
const MAX_KB = 300;

async function call(url: string, init: RequestInit): Promise<{ ok: boolean; body: Record<string, unknown> }> {
  try {
    const res = await fetch(url, init);
    return { ok: res.ok, body: await res.json().catch(() => ({})) };
  } catch {
    return { ok: false, body: { error: "Couldn't reach the server. Try again." } };
  }
}
const json = (method: string, body: unknown): RequestInit => ({ method, headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });

function ClientCard({ client, onChange, onDeleted, canEdit }: { client: Client; onChange: (c: Client) => void; onDeleted: (id: number) => void; canEdit: boolean }) {
  const base = `/api/clients/${client.id}`;
  const [name, setName] = useState(client.name);
  const [brandName, setBrandName] = useState(client.look.name ?? "");
  const [accent, setAccent] = useState<string | null>(client.look.accent);
  const [status, setStatus] = useState<{ ok: boolean; text: string } | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [confirming, setConfirming] = useState(false);
  const [copied, setCopied] = useState(false);
  const file = useRef<HTMLInputElement>(null);
  useAutoClear(status?.ok ? status : null, () => setStatus(null));

  const link = client.status.slug && typeof window !== "undefined" ? `${window.location.origin}/status/${client.status.slug}` : "";
  const lookChanged = brandName.trim() !== (client.look.name ?? "") || accent !== client.look.accent;

  async function run(kind: string, url: string, init: RequestInit, done: string) {
    setBusy(kind);
    setStatus(null);
    const r = await call(url, init);
    if (r.ok && r.body.client) {
      const next = r.body.client as Client;
      onChange(next);
      setName(next.name);
      setStatus({ ok: true, text: done });
    } else if (!r.ok) setStatus({ ok: false, text: (r.body.error as string) ?? "Something went wrong." });
    setBusy(null);
  }

  function upload(e: React.ChangeEvent<HTMLInputElement>) {
    const f = e.target.files?.[0];
    e.target.value = "";
    if (!f) return;
    if (f.size > MAX_KB * 1024) return setStatus({ ok: false, text: `That file is too big. Use an image under ${MAX_KB} KB.` });
    const form = new FormData();
    form.append("logo", f);
    run("logo", `${base}/logo`, { method: "POST", body: form }, "Logo updated.");
  }

  async function remove() {
    setBusy("delete");
    const r = await call(base, { method: "DELETE" });
    if (r.ok) return onDeleted(client.id);
    setStatus({ ok: false, text: (r.body.error as string) ?? "Couldn't delete it." });
    setBusy(null);
  }

  return (
    <details className="group rounded-xl border border-border bg-surface">
      <summary className="flex cursor-pointer list-none items-center justify-between gap-3 px-5 py-4">
        <span className="flex min-w-0 items-center gap-3">
          {client.look.logoUrl && (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={client.look.logoUrl} alt="" className="h-7 w-7 shrink-0 rounded object-contain" />
          )}
          <span className="min-w-0">
            <span className="block truncate font-medium">{client.name}</span>
            <span className="block text-xs text-muted">
              {client.sites} site{client.sites === 1 ? "" : "s"}
              {client.status.enabled ? " · status page on" : ""}
            </span>
          </span>
        </span>
        <span aria-hidden className="text-muted transition-transform group-open:rotate-90">
          ›
        </span>
      </summary>

      <div className="space-y-6 border-t border-border px-5 py-5">
        <form
          className="flex flex-col gap-2 sm:flex-row sm:items-end"
          onSubmit={(e) => {
            e.preventDefault();
            if (name.trim() && name.trim() !== client.name) run("name", base, json("PATCH", { name }), "Renamed.");
          }}
        >
          <div className="min-w-0 flex-1">
            <label htmlFor={`name-${client.id}`} className="mb-1 block text-sm font-medium">
              Client name
            </label>
            <input id={`name-${client.id}`} value={name} onChange={(e) => setName(e.target.value)} maxLength={60} disabled={!canEdit || busy !== null} className={FIELD} />
          </div>
          <button type="submit" disabled={!canEdit || busy !== null || !name.trim() || name.trim() === client.name} className={FILLED}>
            {busy === "name" ? "Saving…" : "Rename"}
          </button>
        </form>

        <section aria-labelledby={`look-${client.id}`}>
          <h3 id={`look-${client.id}`} className="text-sm font-medium">
            Their look
          </h3>
          <p className="text-xs text-muted">Shown on this client&apos;s status page and reports. Anything left empty uses your account&apos;s.</p>
          <div className="mt-3 flex flex-wrap items-center gap-2">
            <input ref={file} type="file" accept="image/png,image/jpeg,image/webp" onChange={upload} className="sr-only" aria-label={`Logo for ${client.name}`} />
            <button type="button" onClick={() => file.current?.click()} disabled={!canEdit || busy !== null} className={SMALL}>
              {busy === "logo" ? "Uploading…" : client.look.logoUrl ? "Replace logo" : "Upload logo"}
            </button>
            {client.look.logoUrl && (
              <button type="button" onClick={() => run("logo", `${base}/logo`, { method: "DELETE" }, "Logo removed.")} disabled={busy !== null} className={SMALL}>
                Remove logo
              </button>
            )}
            <span className="text-xs text-muted">PNG, JPEG or WebP, up to {MAX_KB} KB.</span>
          </div>
          <div className="mt-3">
            <label htmlFor={`brand-${client.id}`} className="mb-1 block text-sm font-medium">
              Name shown next to the logo
            </label>
            <input id={`brand-${client.id}`} value={brandName} onChange={(e) => setBrandName(e.target.value)} maxLength={BRAND_NAME_MAX} placeholder={client.name} disabled={!canEdit || busy !== null} className={`${FIELD} max-w-sm`} />
          </div>
          <fieldset className="mt-3">
            <legend className="text-sm font-medium">Accent colour</legend>
            <div className="mt-2 flex flex-wrap items-center gap-2.5">
              <button
                type="button"
                aria-pressed={accent === null}
                onClick={() => setAccent(null)}
                disabled={!canEdit}
                className={`rounded-full border border-border px-3 py-1.5 text-sm ${accent === null ? "bg-accent text-accent-foreground" : "text-muted hover:text-foreground"}`}
              >
                Same as mine
              </button>
              {ACCENTS.map((a) => (
                <button
                  key={a.id}
                  type="button"
                  title={a.name}
                  aria-label={a.name}
                  aria-pressed={accent === a.id}
                  disabled={!canEdit}
                  onClick={() => setAccent(a.id)}
                  className={`h-8 w-8 rounded-full ring-offset-2 ring-offset-surface ${accent === a.id ? "ring-2 ring-foreground" : "hover:ring-2 hover:ring-border"}`}
                  style={{ background: `linear-gradient(135deg, ${a.light} 50%, ${a.dark} 50%)` }}
                />
              ))}
            </div>
          </fieldset>
          <button
            type="button"
            onClick={() => run("look", base, json("PATCH", { look: { name: brandName.trim() || null, accent } }), "Look saved.")}
            disabled={!canEdit || busy !== null || !lookChanged}
            className={`${FILLED} mt-3`}
          >
            {busy === "look" ? "Saving…" : "Save look"}
          </button>
        </section>

        <section aria-labelledby={`page-${client.id}`}>
          <h3 id={`page-${client.id}`} className="text-sm font-medium">
            Status page
          </h3>
          <p className="text-xs text-muted">One public page showing every site you&apos;ve put under {client.name}, with its logo and colours.</p>
          {client.status.enabled ? (
            <div className="mt-3 space-y-3">
              <div className="flex items-center gap-2">
                <input readOnly aria-label="Status page address" value={link} onFocus={(e) => e.currentTarget.select()} className="min-w-0 flex-1 rounded-md border border-border bg-background px-2.5 py-1.5 font-mono text-xs" />
                <button
                  type="button"
                  onClick={async () => {
                    try {
                      await navigator.clipboard.writeText(link);
                      setCopied(true);
                      setTimeout(() => setCopied(false), 1500);
                    } catch {
                      /* the address is selectable */
                    }
                  }}
                  className="shrink-0 rounded-md border border-border px-2.5 py-1.5 text-xs hover:border-accent hover:text-accent"
                >
                  {copied ? "Copied" : "Copy"}
                </button>
                <a href={link} target="_blank" rel="noopener noreferrer" className="shrink-0 rounded-md border border-border px-2.5 py-1.5 text-xs hover:border-accent hover:text-accent">
                  Open
                </a>
              </div>
              <button type="button" onClick={() => run("page", base, json("PATCH", { statusPage: false }), "Status page turned off.")} disabled={busy !== null} className={SMALL}>
                Turn off
              </button>
              <CustomDomainPanel base={`${base}/domain`} />
            </div>
          ) : (
            <button type="button" onClick={() => run("page", base, json("PATCH", { statusPage: true }), "Status page turned on.")} disabled={!canEdit || busy !== null} className={`${SMALL} mt-3`}>
              {busy === "page" ? "Turning on…" : "Turn on status page"}
            </button>
          )}
        </section>

        {status && (
          <p role={status.ok ? "status" : "alert"} className={`text-sm ${status.ok ? "text-ok" : "text-bad"}`}>
            {status.text}
          </p>
        )}

        <div className="border-t border-border pt-4">
          {confirming ? (
            <div className="flex flex-wrap items-center gap-2">
              <span className="text-sm text-muted">Delete {client.name}? Its sites stay, without a client.</span>
              <button type="button" onClick={remove} disabled={busy !== null} className="rounded-lg bg-bad px-3 py-1.5 text-sm font-medium text-background disabled:opacity-50">
                {busy === "delete" ? "Deleting…" : "Yes, delete"}
              </button>
              <button type="button" onClick={() => setConfirming(false)} className={SMALL}>
                Cancel
              </button>
            </div>
          ) : (
            <button type="button" onClick={() => setConfirming(true)} className="rounded-lg border border-bad/50 px-3 py-1.5 text-sm text-bad hover:bg-bad/10">
              Delete client…
            </button>
          )}
        </div>
      </div>
    </details>
  );
}

/** The Clients page (Agency): the people whose sites you watch, each with its own status page, look and reports. */
export default function Clients() {
  const router = useRouter();
  const [clients, setClients] = useState<Client[] | null>(null);
  const [allowed, setAllowed] = useState(true);
  const [loadError, setLoadError] = useState(false);
  const [name, setName] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    fetch("/api/clients", { cache: "no-store" })
      .then((r) => (r.status === 401 ? (router.replace("/login?next=%2Fdashboard%2Fclients"), Promise.reject()) : r.ok ? r.json() : Promise.reject()))
      .then((d) => {
        if (cancelled) return;
        setClients(d.clients);
        setAllowed(d.allowed);
      })
      .catch(() => !cancelled && setLoadError(true));
    return () => {
      cancelled = true;
    };
  }, [router]);

  async function add(e: React.FormEvent) {
    e.preventDefault();
    if (!name.trim() || busy) return;
    setBusy(true);
    setError(null);
    const r = await call("/api/clients", json("POST", { name }));
    if (r.ok) {
      setClients((cs) => [...(cs ?? []), r.body.client as Client].sort((a, b) => a.name.localeCompare(b.name)));
      setName("");
    } else setError((r.body.error as string) ?? "Something went wrong.");
    setBusy(false);
  }

  if (loadError) {
    return (
      <p role="alert" className="rounded-lg bg-warn-bg px-4 py-3 text-sm text-warn">
        Couldn&apos;t load your clients. Check your connection.
      </p>
    );
  }
  if (!clients) return <p className="text-muted">Loading…</p>;

  return (
    <div>
      <h1 className="flex flex-wrap items-center gap-3 text-3xl font-semibold tracking-tight">
        Clients
        {!allowed && <span className="rounded-full border border-border px-2.5 py-0.5 text-sm font-medium text-muted">Agency</span>}
      </h1>
      <p className="mt-2 text-muted">Group your sites by client. Each client can have its own status page, logo and colours, and its reports can carry them too.</p>

      {!allowed && clients.length === 0 ? (
        <section className="mt-6 rounded-xl border border-border bg-surface p-5">
          <h2 className="font-semibold">Part of the Agency plan</h2>
          <ul className="mt-2 list-disc space-y-1 pl-5 text-sm text-muted">
            <li>Put each site under a client, and filter and group the Sites page by client</li>
            <li>One status page per client covering all their sites, even on the client&apos;s own domain</li>
            <li>The client&apos;s own logo and colours on its status page and reports</li>
            <li>Import hundreds of sites at once, and change many monitors in one go</li>
          </ul>
          <Link href="/dashboard/plans" className="mt-4 inline-block rounded-lg bg-accent px-4 py-2 text-sm font-medium text-accent-foreground hover:opacity-90">
            See the plans
          </Link>
        </section>
      ) : (
        <>
          {allowed ? (
            <form onSubmit={add} className="mt-6 flex flex-col gap-2 sm:flex-row sm:items-end">
              <div className="min-w-0 flex-1 sm:max-w-sm">
                <label htmlFor="new-client" className="mb-1 block text-sm font-medium">
                  Add a client
                </label>
                <input id="new-client" value={name} onChange={(e) => setName(e.target.value)} maxLength={60} placeholder="Northwind Traders" disabled={busy} className={FIELD} />
              </div>
              <button type="submit" disabled={busy || !name.trim()} className={PRIMARY}>
                {busy ? "Adding…" : "Add client"}
              </button>
            </form>
          ) : (
            <p className="mt-6 rounded-lg bg-warn-bg px-4 py-3 text-sm text-warn">Your plan no longer includes clients. What you set up is kept, but you can&apos;t change it unless you&apos;re on Agency again.</p>
          )}
          {error && (
            <p role="alert" className="mt-2 text-sm text-bad">
              {error}
            </p>
          )}
          {clients.length === 0 ? (
            <p className="mt-6 rounded-xl border border-dashed border-border px-5 py-8 text-center text-sm text-muted">No clients yet. Add one above, then put sites under it from the Sites page.</p>
          ) : (
            <div className="mt-6 space-y-3">
              {clients.map((c) => (
                <ClientCard key={c.id} client={c} canEdit={allowed} onChange={(next) => setClients((cs) => cs!.map((x) => (x.id === next.id ? next : x)))} onDeleted={(id) => setClients((cs) => cs!.filter((x) => x.id !== id))} />
              ))}
            </div>
          )}
        </>
      )}
    </div>
  );
}
