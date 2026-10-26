"use client";

import { useState } from "react";

const FIELD = "w-full min-w-0 rounded-lg border border-border bg-background px-3 py-2 text-sm outline-none placeholder:text-muted/70 focus:border-accent focus:ring-2 focus:ring-accent/30 disabled:opacity-60";

interface Result {
  added: number;
  skipped: { line: string; reason: string }[];
}

/** "Import from a list" on the Sites page (Agency): paste or load many sites at once, each optionally with its client. */
export default function ImportSites({ clients, onDone }: { clients: { id: number; name: string }[]; onDone: (message: string) => Promise<void> }) {
  const [text, setText] = useState("");
  const [clientId, setClientId] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<Result | null>(null);
  const lines = text.split(/\r?\n/).filter((l) => l.trim()).length;

  async function loadFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    if (file.size > 100_000) return setError("That file is too big. Import up to 500 sites at a time.");
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
        if (body.added) await onDone(`Added ${body.added} site${body.added === 1 ? "" : "s"}. Their first checks run within a few minutes.`);
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
          <span className="block text-sm text-muted">Add up to 500 sites at once, each with its client if you like.</span>
        </span>
        <span aria-hidden className="text-muted transition-transform group-open:rotate-90">
          ›
        </span>
      </summary>
      <form onSubmit={run} className="space-y-3 border-t border-border px-5 py-4">
        <div>
          <label htmlFor="import-text" className="mb-1 block text-sm font-medium">
            Sites, one per line
          </label>
          <textarea
            id="import-text"
            rows={8}
            value={text}
            onChange={(e) => setText(e.target.value)}
            disabled={busy}
            spellCheck={false}
            placeholder={"example.com\nshop.example.com, Northwind Traders\nanother.org, Contoso"}
            className={`${FIELD} font-mono`}
          />
          <p className="mt-1 text-xs text-muted">A domain per line. Add a comma and a client name to put it under that client; a client that doesn&apos;t exist yet is created. A CSV file works too.</p>
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
            {busy ? "Importing…" : `Import ${lines || ""} site${lines === 1 ? "" : "s"}`}
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
              Added {result.added} site{result.added === 1 ? "" : "s"}
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
      </form>
    </details>
  );
}
