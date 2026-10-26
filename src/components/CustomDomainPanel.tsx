"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import type { DnsCheck, domainView } from "@/lib/custom-domains";

type View = ReturnType<typeof domainView>;
interface State {
  allowed: boolean;
  domain: View | null;
}

const SMALL_BUTTON = "rounded-lg border border-border px-3 py-1.5 text-sm hover:border-accent hover:text-accent disabled:opacity-50";
const INPUT =
  "min-w-0 flex-1 rounded-lg border border-border bg-background px-3 py-2 text-sm outline-none placeholder:text-muted/70 focus:border-accent focus:ring-2 focus:ring-accent/30";

function CopyValue({ label, value }: { label: string; value: string }) {
  const [copied, setCopied] = useState(false);
  async function copy() {
    try {
      await navigator.clipboard.writeText(value);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      /* the value is selectable, so they can copy it by hand */
    }
  }
  return (
    <div className="flex items-center gap-2">
      <input readOnly aria-label={label} value={value} onFocus={(e) => e.currentTarget.select()} className="min-w-0 flex-1 rounded-md border border-border bg-background px-2.5 py-1.5 font-mono text-xs text-foreground" />
      <button type="button" onClick={copy} className="shrink-0 rounded-md border border-border px-2.5 py-1.5 text-xs hover:border-accent hover:text-accent">
        {copied ? "Copied" : "Copy"}
      </button>
    </div>
  );
}

/** What a DNS check found, in plain words. */
function Findings({ dns, domain }: { dns: DnsCheck; domain: View }) {
  const txt = {
    found: ["ok", "We found the ownership record."],
    missing: ["warn", "We couldn't find the ownership record yet."],
    wrong: ["bad", "There's a Site Monitors record, but it isn't the one shown above. Replace it with the value above."],
    error: ["warn", "We couldn't look up your DNS just now. Try again in a minute."],
  }[dns.txt] as [string, string];
  const routing = {
    ok: ["ok", "The domain points at us."],
    missing: ["warn", `The domain doesn't point anywhere yet. Add the CNAME record above.`],
    wrong: ["warn", `The domain points to ${dns.pointsTo ?? "somewhere else"}, not to ${domain.records.cname.target}.`],
    error: ["warn", "We couldn't look up where the domain points just now."],
  }[dns.routing] as [string, string];
  const color = { ok: "text-ok", warn: "text-warn", bad: "text-bad" } as Record<string, string>;
  return (
    <ul className="mt-3 space-y-1 text-sm" aria-live="polite">
      {[txt, routing].map(([tone, text]) => (
        <li key={text} className={color[tone]}>
          {tone === "ok" ? "✓ " : "• "}
          {text}
        </li>
      ))}
    </ul>
  );
}

/** "Your own domain" for a site's public status page (Pro): set it up, prove it's yours, point it at us. */
export default function CustomDomainPanel({ monitorId, base: given }: { monitorId?: number; base?: string }) {
  const [state, setState] = useState<State | null>(null);
  const [dns, setDns] = useState<DnsCheck | null>(null);
  const [input, setInput] = useState("");
  const [busy, setBusy] = useState<"set" | "check" | "remove" | null>(null);
  const [error, setError] = useState<string | null>(null);
  const base = given ?? `/api/monitors/${monitorId}/domain`;

  useEffect(() => {
    let cancelled = false;
    fetch(base, { cache: "no-store" })
      .then((res) => (res.ok ? res.json() : null))
      .then((body) => {
        if (body && !cancelled) setState(body);
      })
      .catch(() => {
        /* leave the panel loading; the rest of the page still works */
      });
    return () => {
      cancelled = true;
    };
  }, [base]);

  async function call(kind: "set" | "check" | "remove", url: string, init: RequestInit) {
    setBusy(kind);
    setError(null);
    try {
      const res = await fetch(url, init);
      const body = await res.json();
      if (!res.ok) setError(body.error ?? "Something went wrong.");
      else {
        setState({ allowed: body.allowed, domain: body.domain });
        setDns(body.domain?.dns ?? null);
        if (kind !== "check") setInput("");
      }
    } catch {
      setError("Couldn't reach the server. Try again.");
    }
    setBusy(null);
  }

  if (!state) return <p className="mt-4 text-xs text-muted">Loading your domain settings…</p>;
  const d = state.domain;

  if (!state.allowed && !d) {
    return (
      <p className="mt-4 border-t border-border pt-4 text-sm text-muted">
        Showing this page on your own domain, like status.yourcompany.com, is part of the Pro plan.{" "}
        <Link href="/dashboard/plans" className="text-accent underline underline-offset-2">
          See the plans
        </Link>
        .
      </p>
    );
  }

  return (
    <div className="mt-4 border-t border-border pt-4">
      <p className="text-sm font-medium">Your own domain</p>

      {!d && (
        <>
          <p className="text-xs text-muted">Show this page at an address like status.yourcompany.com instead of ours. Use a subdomain of a domain you own.</p>
          <form
            className="mt-3 flex flex-col gap-2 sm:flex-row"
            onSubmit={(e) => {
              e.preventDefault();
              if (input.trim() && !busy) call("set", base, { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ domain: input }) });
            }}
          >
            <input value={input} onChange={(e) => setInput(e.target.value)} placeholder="status.yourcompany.com" aria-label="Your domain" maxLength={253} className={INPUT} disabled={busy !== null} />
            <button type="submit" disabled={busy !== null || !input.trim()} className={SMALL_BUTTON}>
              {busy === "set" ? "Saving…" : "Set up"}
            </button>
          </form>
        </>
      )}

      {d && !d.verified && (
        <>
          <p className="text-xs text-muted">
            Add these two records where <span className="font-medium text-foreground">{d.domain}</span> is managed (your DNS provider). Changes can take a few minutes, sometimes longer, to spread.
          </p>
          <ol className="mt-3 space-y-4 text-sm">
            <li>
              <p className="font-medium">1. Prove the domain is yours</p>
              <p className="text-xs text-muted">A TXT record. Paste the value exactly, without quotes.</p>
              <div className="mt-1.5 space-y-1.5">
                <CopyValue label="TXT record name" value={d.records.txt.name} />
                <CopyValue label="TXT record value" value={d.records.txt.value} />
              </div>
            </li>
            <li>
              <p className="font-medium">2. Point it at us</p>
              <p className="text-xs text-muted">A CNAME record, so visitors arrive here.</p>
              <div className="mt-1.5 space-y-1.5">
                <CopyValue label="CNAME record name" value={d.records.cname.name} />
                <CopyValue label="CNAME record value" value={d.records.cname.target} />
              </div>
            </li>
          </ol>
          <p className="mt-3 text-xs text-muted">Some DNS providers want only the first part of a name (for a name ending in your domain, leave that part off). A domain can&apos;t have a CNAME and other records at the same name.</p>
        </>
      )}

      {d && d.verified && (
        <div className="mt-1 text-sm">
          <p className="text-ok">✓ Connected: you own {d.domain}.</p>
          <p className="mt-1 text-muted">
            This status page is shown at{" "}
            <a href={`https://${d.domain}`} target="_blank" rel="noopener noreferrer" className="text-accent underline underline-offset-2">
              https://{d.domain}
            </a>{" "}
            once the domain points at us. We re-check ownership daily, and let go of the domain if the ownership record is removed for several days.
          </p>
          <details className="mt-2">
            <summary className="cursor-pointer text-xs text-accent underline underline-offset-2">Show the records</summary>
            <div className="mt-2 space-y-1.5">
              <CopyValue label="TXT record name" value={d.records.txt.name} />
              <CopyValue label="TXT record value" value={d.records.txt.value} />
              <CopyValue label="CNAME record name" value={d.records.cname.name} />
              <CopyValue label="CNAME record value" value={d.records.cname.target} />
            </div>
          </details>
        </div>
      )}

      {d && dns && <Findings dns={dns} domain={d} />}
      {error && (
        <p role="alert" className="mt-2 text-sm text-bad">
          {error}
        </p>
      )}

      {d && (
        <div className="mt-3 flex flex-wrap gap-2">
          {state.allowed && (
            <button type="button" disabled={busy !== null} onClick={() => call("check", `${base}/verify`, { method: "POST" })} className={SMALL_BUTTON}>
              {busy === "check" ? "Checking…" : "Check DNS"}
            </button>
          )}
          <button
            type="button"
            disabled={busy !== null}
            onClick={() => {
              setDns(null);
              call("remove", base, { method: "DELETE" });
            }}
            className={SMALL_BUTTON}
          >
            {busy === "remove" ? "Removing…" : d.verified ? "Disconnect domain" : "Use a different domain"}
          </button>
        </div>
      )}
      {d && !state.allowed && <p className="mt-3 text-xs text-warn">Your plan no longer includes your own domain, so this page is no longer shown there.</p>}
    </div>
  );
}
