"use client";

import Link from "next/link";
import { useState } from "react";
import { intervalText } from "@/components/site-health";

// Mirrors HEARTBEAT_EVERY and HEARTBEAT_GRACE in monitor-kinds.ts (the server checks them).
const MIN = 60_000;
const HOUR = 60 * MIN;
const DAY = 24 * HOUR;
export const HEARTBEAT_EVERY = [5 * MIN, 15 * MIN, 30 * MIN, HOUR, 6 * HOUR, 12 * HOUR, DAY, 7 * DAY];
export const HEARTBEAT_GRACE = [MIN, 5 * MIN, 15 * MIN, 30 * MIN, HOUR, 6 * HOUR];

export type Kind = "site" | "http" | "tcp" | "heartbeat";

const KINDS: { id: Kind; label: string; hint: string }[] = [
  { id: "site", label: "Website", hint: "Uptime, SSL certificate and domain expiry for a whole site." },
  { id: "http", label: "Page", hint: "One address, like a checkout page or an API endpoint, with an optional keyword check." },
  { id: "tcp", label: "Port", hint: "A server port that should accept connections, like a mail or database server." },
  { id: "heartbeat", label: "Heartbeat", hint: "A scheduled job pings us each time it runs. We tell you when a ping is late." },
];

export const FIELD =
  "min-w-0 w-full rounded-lg border border-border bg-surface px-4 py-3 text-base outline-none placeholder:text-muted/70 focus:border-accent focus:ring-2 focus:ring-accent/30 disabled:opacity-60";
const LABEL = "mb-1.5 block text-sm font-medium";

/** The fields for one kind of monitor. Used to add one, and on a monitor's page to change it. */
export interface MonitorFields {
  host: string;
  url: string;
  keyword: string;
  keywordMode: "contains" | "absent";
  server: string;
  port: string;
  name: string;
  everyMs: number;
  graceMs: number;
}

export const EMPTY_FIELDS: MonitorFields = { host: "", url: "", keyword: "", keywordMode: "contains", server: "", port: "", name: "", everyMs: DAY, graceMs: HOUR };

/** What the API expects for a kind, from the form's fields. */
export function fieldsBody(kind: Kind, f: MonitorFields): Record<string, unknown> {
  switch (kind) {
    case "http":
      return { url: f.url, keyword: f.keyword, keywordMode: f.keywordMode };
    case "tcp":
      return { host: f.server, port: f.port };
    case "heartbeat":
      return { name: f.name, everyMs: f.everyMs, graceMs: f.graceMs };
    default:
      return { host: f.host };
  }
}

/** Whether enough is filled in to try saving. */
export const fieldsReady = (kind: Kind, f: MonitorFields) =>
  kind === "http" ? !!f.url.trim() : kind === "tcp" ? !!f.server.trim() && !!f.port.trim() : kind === "heartbeat" ? !!f.name.trim() : !!f.host.trim();

/** The inputs for one kind. `idPrefix` keeps label ids unique when two forms are on a page. */
export function KindFields({
  kind,
  f,
  set,
  disabled,
  idPrefix,
  autoFocus,
}: {
  kind: Kind;
  f: MonitorFields;
  set: (patch: Partial<MonitorFields>) => void;
  disabled: boolean;
  idPrefix: string;
  autoFocus?: boolean;
}) {
  const id = (name: string) => `${idPrefix}-${name}`;
  const common = { disabled, autoCapitalize: "none", autoCorrect: "off", spellCheck: false, autoFocus } as const;
  switch (kind) {
    case "http":
      return (
        <div className="grid gap-3 sm:grid-cols-[1fr_auto]">
          <div className="sm:col-span-2">
            <label htmlFor={id("url")} className={LABEL}>
              Page address
            </label>
            <input id={id("url")} {...common} inputMode="url" placeholder="https://example.com/checkout" value={f.url} onChange={(e) => set({ url: e.target.value })} className={FIELD} />
          </div>
          <div>
            <label htmlFor={id("keyword")} className={LABEL}>
              Keyword <span className="font-normal text-muted">(optional)</span>
            </label>
            <input
              id={id("keyword")}
              disabled={disabled}
              maxLength={200}
              placeholder="Add to basket"
              value={f.keyword}
              onChange={(e) => set({ keyword: e.target.value })}
              className={FIELD}
            />
          </div>
          <div>
            <label htmlFor={id("mode")} className={LABEL}>
              The page must
            </label>
            <select id={id("mode")} disabled={disabled || !f.keyword.trim()} value={f.keywordMode} onChange={(e) => set({ keywordMode: e.target.value as MonitorFields["keywordMode"] })} className={FIELD}>
              <option value="contains">contain it</option>
              <option value="absent">not contain it</option>
            </select>
          </div>
          <p className="text-xs text-muted sm:col-span-2">
            Down when the page answers with an error (HTTP 400 or above), or breaks the keyword rule. Use a word that only shows when the page works, like &ldquo;Add to basket&rdquo;, or one
            that only shows when it breaks, like &ldquo;Fatal error&rdquo;.
          </p>
        </div>
      );
    case "tcp":
      return (
        <div className="grid gap-3 sm:grid-cols-[1fr_8rem]">
          <div>
            <label htmlFor={id("server")} className={LABEL}>
              Server
            </label>
            <input id={id("server")} {...common} placeholder="mail.example.com" value={f.server} onChange={(e) => set({ server: e.target.value })} className={FIELD} />
          </div>
          <div>
            <label htmlFor={id("port")} className={LABEL}>
              Port
            </label>
            <input id={id("port")} disabled={disabled} inputMode="numeric" placeholder="587" value={f.port} onChange={(e) => set({ port: e.target.value.replace(/\D/g, "").slice(0, 5) })} className={FIELD} />
          </div>
          <p className="text-xs text-muted sm:col-span-2">We open a connection to the port and close it straight away. Down when it&apos;s refused or doesn&apos;t answer within 10 seconds.</p>
        </div>
      );
    case "heartbeat":
      return (
        <div className="grid gap-3 sm:grid-cols-3">
          <div className="sm:col-span-3">
            <label htmlFor={id("name")} className={LABEL}>
              Job name
            </label>
            <input id={id("name")} disabled={disabled} autoFocus={autoFocus} maxLength={80} placeholder="Nightly backup" value={f.name} onChange={(e) => set({ name: e.target.value })} className={FIELD} />
          </div>
          <div>
            <label htmlFor={id("every")} className={LABEL}>
              It runs every
            </label>
            <select id={id("every")} disabled={disabled} value={f.everyMs} onChange={(e) => set({ everyMs: Number(e.target.value) })} className={FIELD}>
              {HEARTBEAT_EVERY.map((ms) => (
                <option key={ms} value={ms}>
                  {intervalText(ms)}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label htmlFor={id("grace")} className={LABEL}>
              Allow it to be late by
            </label>
            <select id={id("grace")} disabled={disabled} value={f.graceMs} onChange={(e) => set({ graceMs: Number(e.target.value) })} className={FIELD}>
              {HEARTBEAT_GRACE.map((ms) => (
                <option key={ms} value={ms}>
                  {intervalText(ms)}
                </option>
              ))}
            </select>
          </div>
          <p className="text-xs text-muted sm:col-span-3 sm:self-end">You&apos;ll get a ping address to call from the job once it&apos;s added.</p>
        </div>
      );
    default:
      return (
        <div>
          <label htmlFor={id("host")} className="sr-only">
            Domain name
          </label>
          <input id={id("host")} {...common} inputMode="url" placeholder="example.com" value={f.host} onChange={(e) => set({ host: e.target.value })} className={FIELD} />
          <p className="mt-2 text-xs text-muted">We set up uptime, SSL certificate and domain expiry checks automatically, and email you a confirmation.</p>
        </div>
      );
  }
}

/** The "Add a monitor" box on the Sites page. */
export default function AddMonitor({
  count,
  limit,
  planName,
  kinds,
  onAdded,
}: {
  count: number;
  limit: number;
  planName: string;
  /** The kinds this plan can add. */
  kinds: string[];
  onAdded: (message: string) => Promise<void>;
}) {
  const [kind, setKind] = useState<Kind>("site");
  const [f, setF] = useState<MonitorFields>(EMPTY_FIELDS);
  const [adding, setAdding] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const full = count >= limit;
  const allowed = kinds.includes(kind);

  async function add(e: React.FormEvent) {
    e.preventDefault();
    if (adding || !allowed || !fieldsReady(kind, f)) return;
    setAdding(true);
    setError(null);
    try {
      const res = await fetch("/api/monitors", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ kind, ...fieldsBody(kind, f) }),
      });
      const body = await res.json();
      if (!res.ok) setError(body.error ?? "Something went wrong.");
      else {
        setF(EMPTY_FIELDS);
        await onAdded(
          kind === "heartbeat"
            ? `Added ${body.monitor.host}. Open it to copy its ping address into your job.`
            : `Now watching ${body.monitor.host}. We've emailed you a confirmation and started the checks.`,
        );
      }
    } catch {
      setError("Couldn't reach the server. Try again.");
    }
    setAdding(false);
  }

  return (
    <section id="add" className="mt-6 scroll-mt-6 rounded-xl border border-border bg-surface p-5" aria-labelledby="add-heading">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <h2 id="add-heading" className="font-semibold">
          Add a monitor
        </h2>
        <p className="text-sm text-muted">
          {count} of {limit} monitors · {planName} plan
        </p>
      </div>

      <div role="radiogroup" aria-label="What to monitor" className="mt-3 inline-flex flex-wrap gap-1 rounded-lg border border-border p-1">
        {KINDS.map((k) => (
          <button
            key={k.id}
            type="button"
            role="radio"
            aria-checked={kind === k.id}
            onClick={() => {
              setKind(k.id);
              setError(null);
            }}
            className={`flex items-center gap-1.5 rounded-md px-3 py-1.5 text-sm ${kind === k.id ? "bg-accent text-accent-foreground" : "text-muted hover:text-foreground"}`}
          >
            {k.label}
            {!kinds.includes(k.id) && <span className={`rounded-full border px-1.5 text-[10px] font-medium ${kind === k.id ? "border-accent-foreground/40" : "border-border"}`}>Starter</span>}
          </button>
        ))}
      </div>
      <p className="mt-2 text-sm text-muted">{KINDS.find((k) => k.id === kind)?.hint}</p>

      {allowed ? (
        <form onSubmit={add} className="mt-4">
          <KindFields kind={kind} f={f} set={(patch) => setF((prev) => ({ ...prev, ...patch }))} disabled={full || adding} idPrefix="new" />
          <button
            type="submit"
            disabled={full || adding || !fieldsReady(kind, f)}
            className="mt-4 rounded-lg bg-accent px-6 py-3 text-base font-medium text-accent-foreground transition-opacity hover:opacity-90 disabled:opacity-50"
          >
            {adding ? "Setting up…" : kind === "site" ? "Add site" : "Add monitor"}
          </button>
        </form>
      ) : (
        <p className="mt-4 rounded-lg border border-dashed border-border px-4 py-3 text-sm text-muted">
          {KINDS.find((k) => k.id === kind)?.label} monitors are part of the Starter plan.{" "}
          <Link href="/dashboard/plans" className="text-accent underline underline-offset-2">
            See the plans
          </Link>
          .
        </p>
      )}

      {full && (
        <p className="mt-3 text-xs text-muted">
          You&apos;ve reached your plan&apos;s limit. Remove a monitor, or{" "}
          <Link href="/dashboard/plans" className="text-accent underline underline-offset-2">
            see the plans
          </Link>
          .
        </p>
      )}
      {error && (
        <p role="alert" className="mt-3 rounded-lg bg-bad-bg px-4 py-3 text-sm text-bad">
          {error}
        </p>
      )}
    </section>
  );
}
