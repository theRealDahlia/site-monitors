"use client";

import { Row, formatDate } from "@/components/CheckerParts";
import FreeChecks from "@/components/FreeChecks";
import { useChecker } from "@/components/useChecker";
import WatchDomain from "@/components/WatchDomain";
import type { SslResult, SslStatus } from "@/lib/ssl-check";

const STATUS_STYLE: Record<SslStatus, { label: string; classes: string }> = {
  valid: { label: "Valid", classes: "bg-ok-bg text-ok" },
  expiring: { label: "Expiring soon", classes: "bg-warn-bg text-warn" },
  expired: { label: "Expired", classes: "bg-bad-bg text-bad" },
  invalid: { label: "Problem found", classes: "bg-bad-bg text-bad" },
};

export default function SslChecker() {
  const { host, setHost, loading, error, result, usage, limited, submit } =
    useChecker<SslResult>("/api/ssl-check");

  const style = result ? STATUS_STYLE[result.status] : null;

  return (
    <div>
      <form onSubmit={submit} className="flex flex-col gap-3 sm:flex-row">
        <label htmlFor="host" className="sr-only">
          Domain name
        </label>
        <input
          id="host"
          type="text"
          inputMode="url"
          autoCapitalize="none"
          autoCorrect="off"
          spellCheck={false}
          placeholder="example.com"
          value={host}
          disabled={limited}
          onChange={(e) => setHost(e.target.value)}
          className="min-w-0 flex-1 rounded-lg border border-border bg-surface px-4 py-3 text-base outline-none placeholder:text-muted/70 focus:border-accent focus:ring-2 focus:ring-accent/30"
        />
        <button
          type="submit"
          disabled={loading || limited || !host.trim()}
          className="rounded-lg bg-accent px-6 py-3 text-base font-medium text-accent-foreground transition-opacity hover:opacity-90 disabled:opacity-50"
        >
          {loading ? "Checking…" : "Check certificate"}
        </button>
      </form>
      <FreeChecks usage={usage} />

      <div aria-live="polite" className="mt-6">
        {error && (
          <p role="alert" className="rounded-lg bg-bad-bg px-4 py-3 text-sm text-bad">
            {error}
          </p>
        )}

        {result && style && (
          <section className="rounded-xl border border-border bg-surface p-5 sm:p-6">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <h3 className="text-lg font-semibold break-all">{result.host}</h3>
              <span className={`rounded-full px-3 py-1 text-sm font-medium ${style.classes}`}>
                {style.label}
              </span>
            </div>

            <p className="mt-2 text-2xl font-semibold tracking-tight">
              {result.cert.daysRemaining < 0
                ? `Expired ${Math.abs(result.cert.daysRemaining)} days ago`
                : `${result.cert.daysRemaining} days left`}
            </p>

            {result.problems.length > 0 && (
              <ul className="mt-4 space-y-1.5 text-sm">
                {result.problems.map((p) => (
                  <li key={p} className={result.status === "expiring" ? "text-warn" : "text-bad"}>
                    • {p}
                  </li>
                ))}
              </ul>
            )}

            <dl className="mt-5 divide-y divide-border border-t border-border">
              <Row label="Issued to">{result.cert.subject}</Row>
              <Row label="Issued by">{result.cert.issuer}</Row>
              <Row label="Valid from">{formatDate(result.cert.validFrom)}</Row>
              <Row label="Expires">{formatDate(result.cert.validTo)}</Row>
              <Row label="Protocol">{result.protocol ?? "Unknown"}</Row>
              <Row label="Chain length">
                {result.chainLength} certificate{result.chainLength === 1 ? "" : "s"}
              </Row>
              <Row label="Covers">
                {result.cert.sans.length > 0 ? (
                  <span className="font-mono text-[0.85em]">
                    {result.cert.sans.slice(0, 8).join(", ")}
                    {result.cert.sans.length > 8 && ` +${result.cert.sans.length - 8} more`}
                  </span>
                ) : (
                  "—"
                )}
              </Row>
            </dl>

            <WatchDomain
              key={result.host}
              domain={result.host}
              kind="ssl"
              subject="SSL certificate"
              daysRemaining={result.cert.daysRemaining}
            />

            <p className="mt-4 text-xs text-muted">
              Checked {new Date(result.checkedAt).toLocaleString()}
            </p>
          </section>
        )}
      </div>
    </div>
  );
}
