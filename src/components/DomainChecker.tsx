"use client";

import { Row, formatDate } from "@/components/CheckerParts";
import FreeChecks from "@/components/FreeChecks";
import { useChecker } from "@/components/useChecker";
import WatchDomain from "@/components/WatchDomain";
import type { DomainResult, DomainState } from "@/lib/domain-check";

const STATE_STYLE: Record<DomainState, { label: string; classes: string }> = {
  ok: { label: "Active", classes: "bg-ok-bg text-ok" },
  expiring: { label: "Expiring soon", classes: "bg-warn-bg text-warn" },
  expired: { label: "Expired", classes: "bg-bad-bg text-bad" },
  unknown: { label: "Expiry not published", classes: "bg-warn-bg text-warn" },
};

export default function DomainChecker() {
  const { host, setHost, loading, error, result, usage, limited, submit } =
    useChecker<DomainResult>("/api/domain-check");

  const style = result ? STATE_STYLE[result.state] : null;
  const warnTone = result?.state === "expiring" || result?.state === "unknown";

  return (
    <div>
      <form onSubmit={submit} className="flex flex-col gap-3 sm:flex-row">
        <label htmlFor="domain-host" className="sr-only">
          Domain name
        </label>
        <input
          id="domain-host"
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
          {loading ? "Checking…" : "Check domain"}
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
              <h3 className="text-lg font-semibold break-all">{result.domain}</h3>
              <span className={`rounded-full px-3 py-1 text-sm font-medium ${style.classes}`}>
                {style.label}
              </span>
            </div>

            {result.input !== result.domain && (
              <p className="mt-1 text-sm text-muted">
                Showing the registered domain for {result.input}.
              </p>
            )}

            {result.daysRemaining !== null && (
              <p className="mt-2 text-2xl font-semibold tracking-tight">
                {result.daysRemaining < 0
                  ? `Expired ${Math.abs(result.daysRemaining)} days ago`
                  : `${result.daysRemaining} days left`}
              </p>
            )}

            {result.problems.length > 0 && (
              <ul className="mt-4 space-y-1.5 text-sm">
                {result.problems.map((p) => (
                  <li key={p} className={warnTone ? "text-warn" : "text-bad"}>
                    • {p}
                  </li>
                ))}
              </ul>
            )}

            <dl className="mt-5 divide-y divide-border border-t border-border">
              <Row label="Registrar">{result.registrar ?? "Not published"}</Row>
              <Row label="Registered">{formatDate(result.registeredAt)}</Row>
              <Row label="Expires">{formatDate(result.expiresAt)}</Row>
              <Row label="Last changed">{formatDate(result.updatedAt)}</Row>
              <Row label="Nameservers">
                {result.nameservers.length > 0 ? (
                  <span className="font-mono text-[0.85em]">{result.nameservers.join(", ")}</span>
                ) : (
                  "Not published"
                )}
              </Row>
              <Row label="DNSSEC">
                {result.dnssecSigned === null ? "Not published" : result.dnssecSigned ? "Signed" : "Not signed"}
              </Row>
              <Row label="Status codes">
                {result.statuses.length > 0 ? result.statuses.join(", ") : "None listed"}
              </Row>
            </dl>

            <WatchDomain
              key={result.domain}
              domain={result.domain}
              subject="registration"
              signedIn={usage?.signedIn ?? false}
              daysRemaining={result.daysRemaining}
            />

            <p className="mt-4 text-xs text-muted">
              Checked {new Date(result.checkedAt).toLocaleString()} · data from the registry via RDAP
            </p>
          </section>
        )}
      </div>
    </div>
  );
}
