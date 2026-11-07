"use client";

import { Fragment, useRef, useState } from "react";
import { importHint } from "@/lib/import-lines";

const FIELD = "w-full min-w-0 rounded-lg border border-border bg-background px-3 py-2 text-sm outline-none placeholder:text-muted/70 focus:border-accent focus:ring-2 focus:ring-accent/30 disabled:opacity-60";

interface Result {
  added: number;
  heartbeats: number;
  /** The ping address of each heartbeat that was just added. */
  pings: { name: string; pingUrl: string }[];
  skipped: { line: string; reason: string }[];
}

const PLACEHOLDER = [
  "site, example.com, Northwind Traders",
  "page, https://example.com/checkout, Order confirmed, C, Northwind Traders",
  "port, mail.example.com:25, Contoso",
  "heartbeat, Nightly backup, Contoso, 1d, 1h",
].join("\n");

/** "Import from a list" on the Sites page (Agency): paste or load many monitors of any kind at once, each optionally with its client. */
export default function ImportSites({ clients, onDone }: { clients: { id: number; name: string }[]; onDone: (message: string) => Promise<void> }) {
  const [text, setText] = useState("");
  const [clientId, setClientId] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<Result | null>(null);
  const [copied, setCopied] = useState<string | null>(null);
  const lines = text.split(/\r?\n/).filter((l) => l.trim()).length;

  async function copy(key: string, value: string) {
    try {
      await navigator.clipboard.writeText(value);
      setCopied(key);
      setTimeout(() => setCopied(null), 1500);
    } catch {
      /* the addresses are selectable */
    }
  }

  // Faint hints for the fields still to type on the line the cursor is at the end of. A copy of the text sits behind
  // the box, invisible, so the hint lines up right after what was typed.
  const [caret, setCaret] = useState(0);
  const [focused, setFocused] = useState(false);
  const mirror = useRef<HTMLDivElement>(null);
  const textLines = text.split("\n");
  const caretLine = text.slice(0, caret).split("\n").length - 1;
  const atLineEnd = caret >= text.length || text[caret] === "\n";
  const hint = focused && atLineEnd ? importHint(textLines[caretLine].replace(/\r$/, "")) : "";

  async function loadFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    if (file.size > 100_000) return setError("That file is too big. Import up to 500 monitors at a time.");
    setError(null);
    setText(await file.text());
  }

  async function run(e: React.FormEvent) {
    e.preventDefault();
    if (busy || !text.trim()) return;
    setBusy(true);
    setError(null);
    setResult(null);
    try {
      const res = await fetch("/api/monitors/import", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ text, clientId: clientId || null }) });
      const body = await res.json();
      if (!res.ok) setError(body.error ?? "Something went wrong.");
      else {
        setResult(body);
        // What couldn't be added stays in the box, so it can be fixed and tried again.
        const failed = new Set((body.skipped as Result["skipped"]).map((s) => s.line));
        setText(text.split(/\r?\n/).filter((l) => failed.has(l.trim())).join("\n"));
        if (body.added) {
          const pings = body.heartbeats ? ` Copy the heartbeats' ping addresses from the import box above.` : "";
          await onDone(`Added ${body.added} monitor${body.added === 1 ? "" : "s"}. Their first checks run within a few minutes.${pings}`);
        }
      }
    } catch {
      setError("Couldn't reach the server. Try again.");
    }
    setBusy(false);
  }

  return (
    <details className="group mt-4 rounded-xl border border-border bg-surface">
      <summary className="flex cursor-pointer list-none items-center justify-between gap-3 px-5 py-4">
        <span>
          <span className="block font-semibold">Import from a list</span>
          <span className="block text-sm text-muted">Add up to 500 sites, pages, ports and heartbeats at once, each with its client if you like.</span>
        </span>
        <span aria-hidden className="text-muted transition-transform group-open:rotate-90">
          ›
        </span>
      </summary>
      <form onSubmit={run} className="space-y-3 border-t border-border px-5 py-4">
        <div>
          <label htmlFor="import-text" className="mb-1 block text-sm font-medium">
            Monitors, one per line
          </label>
          <div className="relative rounded-lg bg-background">
            <div
              ref={mirror}
              aria-hidden
              className="pointer-events-none absolute inset-0 overflow-hidden whitespace-pre-wrap break-words rounded-lg border border-transparent px-3 py-2 font-mono text-sm [scrollbar-gutter:stable]"
            >
              {textLines.map((l, i) => (
                <Fragment key={i}>
                  {i > 0 && "\n"}
                  <span className="text-transparent">{l}</span>
                  {hint && i === caretLine && <span className="text-muted/70">{hint}</span>}
                </Fragment>
              ))}
            </div>
            <textarea
              id="import-text"
              rows={8}
              value={text}
              onChange={(e) => {
                setText(e.target.value);
                setCaret(e.target.selectionStart);
              }}
              onSelect={(e) => setCaret(e.currentTarget.selectionStart)}
              onFocus={() => setFocused(true)}
              onBlur={() => setFocused(false)}
              onScroll={(e) => {
                if (mirror.current) mirror.current.scrollTop = e.currentTarget.scrollTop;
              }}
              disabled={busy}
              spellCheck={false}
              placeholder={PLACEHOLDER}
              aria-describedby="import-help"
              className={`${FIELD.replace("bg-background", "bg-transparent")} relative block font-mono [scrollbar-gutter:stable]`}
            />
          </div>
          <div id="import-help" className="mt-1 space-y-1 text-xs text-muted">
            <p>
              Start every line with its type: <code>site</code>, <code>page</code>, <code>port</code> or <code>heartbeat</code>. The client comes after the address (for a page, after its keyword); one that
              doesn&apos;t exist yet is created. A CSV file works too.
            </p>
            <ul className="list-disc pl-5">
              <li>
                <code>site, example.com, Client</code>
              </li>
              <li>
                <code>page, https://example.com/pricing, keyword, C, Client</code> (<code>C</code> = contains, <code>A</code> = absent; you can write the whole word, and a typo of one letter or two swapped letters is fine, as long as the word starts with the right letter. The keyword, rule and
                client are optional, and the rule defaults to <code>C</code>)
              </li>
              <li>
                <code>port, mail.example.com:25, Client</code>
              </li>
              <li>
                <code>heartbeat, Nightly backup, Client, 1d, 1h</code> (how often it runs, then how late a check-in may be; both optional)
              </li>
            </ul>
            <p>Put a client name or keyword in &quot;double quotes&quot; if it contains a comma.</p>
          </div>
        </div>
        <div className="flex flex-wrap items-end gap-3">
          {clients.length > 0 && (
            <div>
              <label htmlFor="import-client" className="mb-1 block text-sm font-medium">
                Client for lines without one
              </label>
              <select id="import-client" value={clientId} onChange={(e) => setClientId(e.target.value)} disabled={busy} className={FIELD}>
                <option value="">No client</option>
                {clients.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
              </select>
            </div>
          )}
          <label className="cursor-pointer rounded-lg border border-border px-3 py-2 text-sm hover:border-accent hover:text-accent">
            Load a file
            <input type="file" accept=".csv,.txt,text/csv,text/plain" onChange={loadFile} disabled={busy} className="sr-only" />
          </label>
          <button type="submit" disabled={busy || !text.trim()} className="rounded-lg bg-accent px-4 py-2 text-sm font-medium text-accent-foreground hover:opacity-90 disabled:opacity-50">
            {busy ? "Importing…" : `Import ${lines || ""} monitor${lines === 1 ? "" : "s"}`}
          </button>
        </div>
        {error && (
          <p role="alert" className="text-sm text-bad">
            {error}
          </p>
        )}
        {result && (
          <div role="status" className="text-sm">
            <p className={result.added ? "text-ok" : "text-muted"}>
              Added {result.added} monitor{result.added === 1 ? "" : "s"}
              {result.skipped.length ? `, skipped ${result.skipped.length}` : ""}.
            </p>
            {result.skipped.length > 0 && (
              <ul className="mt-1 max-h-40 list-disc overflow-y-auto pl-5 text-muted">
                {result.skipped.map((s) => (
                  <li key={s.line}>
                    <span className="break-all font-medium text-foreground">{s.line}</span>: {s.reason}
                  </li>
                ))}
              </ul>
            )}
          </div>
        )}
        {result && result.pings.length > 0 && (
          <div className="rounded-lg border border-border bg-background p-4">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <p className="text-sm font-medium">Ping addresses for the new heartbeats</p>
              <button
                type="button"
                onClick={() => copy("all", result.pings.map((p) => `${p.name}\t${p.pingUrl}`).join("\n"))}
                className="shrink-0 rounded-md border border-border px-2.5 py-1.5 text-xs hover:border-accent hover:text-accent"
              >
                {copied === "all" ? "Copied" : "Copy all"}
              </button>
            </div>
            <p className="mt-1 text-xs text-muted">
              Call each address from the end of its job whenever it runs successfully. They&apos;re also on each heartbeat&apos;s page. Keep them private: anyone with an address can check in for that job.
            </p>
            <ul className="mt-3 space-y-3">
              {result.pings.map((p) => (
                <li key={p.pingUrl}>
                  <p className="mb-1 break-words text-xs text-muted">{p.name}</p>
                  <div className="flex items-center gap-2">
                    <input readOnly aria-label={`Ping address for ${p.name}`} value={p.pingUrl} onFocus={(e) => e.currentTarget.select()} className="min-w-0 flex-1 rounded-md border border-border bg-surface px-2.5 py-1.5 font-mono text-xs" />
                    <button type="button" onClick={() => copy(p.pingUrl, p.pingUrl)} className="shrink-0 rounded-md border border-border px-2.5 py-1.5 text-xs hover:border-accent hover:text-accent">
                      {copied === p.pingUrl ? "Copied" : "Copy"}
                    </button>
                  </div>
                </li>
              ))}
            </ul>
          </div>
        )}
      </form>
    </details>
  );
}
