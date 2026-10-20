"use client";

import Link from "next/link";
import { type Monitor, ago } from "@/components/monitor-ui";
import { AI_BOTS, type AiResult, type AiStatus, type BotRole, ROLE_LABEL, type Severity } from "@/lib/ai-bots";

type Tone = "ok" | "warn" | "bad" | "muted";
const TEXT: Record<Tone, string> = { ok: "text-ok", warn: "text-warn", bad: "text-bad", muted: "text-muted" };

const HEADLINE: Record<AiStatus | "pending", { text: string; tone: Tone }> = {
  pending: { text: "Not checked yet", tone: "muted" },
  ok: { text: "Readable by AI search", tone: "ok" },
  attention: { text: "Could be better", tone: "warn" },
  problem: { text: "Blocked or hard to read", tone: "bad" },
  unknown: { text: "Couldn't tell", tone: "muted" },
};

const SEVERITY: Record<Severity, { label: string; classes: string }> = {
  problem: { label: "Problem", classes: "bg-bad-bg text-bad" },
  notice: { label: "Suggestion", classes: "bg-warn-bg text-warn" },
  info: { label: "Note", classes: "border border-border text-muted" },
  good: { label: "Good", classes: "bg-ok-bg text-ok" },
};

const ROBOTS = { allowed: ["Allowed", "text-ok"], partial: ["Some pages blocked", "text-warn"], blocked: ["Blocked", "text-bad"], unknown: ["Couldn't tell", "text-muted"] } as const;

function probeText(probe: string | undefined, status: number | null | undefined): [string, string] {
  switch (probe) {
    case "ok":
      return ["Answered", "text-ok"];
    case "blocked":
      return [status ? `Turned away (HTTP ${status})` : "Connection cut off", "text-bad"];
    case "limited":
      return ["Slowed down (HTTP 429)", "text-muted"];
    case "error":
      return ["No answer", "text-muted"];
    default:
      return ["", ""];
  }
}

const found = (v: boolean | null) => (v === null ? "Couldn't tell" : v ? "Found" : "Not found");

function Details({ result }: { result: AiResult }) {
  const roles: BotRole[] = ["search", "assistant", "training"];
  const shown = result.findings.filter((f) => f.severity !== "good" || result.findings.length === 1);
  return (
    <div className="mt-3 space-y-5 rounded-lg border border-border bg-background p-4 text-sm">
      {result.status === "unknown" ? (
        <p className="text-muted">{result.error ?? "We couldn't read the site this time. We'll try again in a few hours."}</p>
      ) : (
        <>
          {shown.length > 0 ? (
            <ul className="space-y-3">
              {shown.map((f) => (
                <li key={f.id}>
                  <p className="flex flex-wrap items-center gap-2 font-medium text-foreground">
                    <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${SEVERITY[f.severity].classes}`}>{SEVERITY[f.severity].label}</span>
                    {f.title}
                  </p>
                  <p className="mt-1 text-muted">{f.detail}</p>
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-muted">Nothing to fix.</p>
          )}

          <div className="overflow-x-auto">
            <table className="w-full min-w-[480px] border-collapse text-left">
              <caption className="sr-only">What each AI crawler can do on this site</caption>
              <thead>
                <tr className="border-b border-border text-xs text-muted">
                  <th scope="col" className="py-2 pr-3 font-medium">Crawler</th>
                  <th scope="col" className="py-2 pr-3 font-medium">robots.txt says</th>
                  <th scope="col" className="py-2 font-medium">Your server, when asked by name</th>
                </tr>
              </thead>
              <tbody>
                {roles.map((role) => (
                  <RoleRows key={role} role={role} result={result} />
                ))}
              </tbody>
            </table>
          </div>

          <dl className="grid grid-cols-[8rem_1fr] gap-x-3 gap-y-1 text-muted">
            <dt>Sitemap</dt>
            <dd>{found(result.extras.sitemap)}</dd>
            <dt>llms.txt</dt>
            <dd>{found(result.extras.llmsTxt)} (optional)</dd>
            {result.page && (
              <>
                <dt>Text in the HTML</dt>
                <dd>about {result.page.words} words, before any JavaScript runs</dd>
              </>
            )}
          </dl>
        </>
      )}
      <p className="text-xs text-muted">
        This checks whether AI crawlers can reach and read your site. It can&apos;t tell whether any AI tool mentions you, and some firewalls check a crawler&apos;s network address
        rather than its name, which we can&apos;t test. Crawler names and rules come from each company&apos;s own documentation and can change.
      </p>
    </div>
  );
}

function RoleRows({ role, result }: { role: BotRole; result: AiResult }) {
  return (
    <>
      <tr>
        <th colSpan={3} scope="colgroup" className="pb-1 pt-3 text-xs font-semibold uppercase tracking-wide text-muted">
          {ROLE_LABEL[role]}
          {role === "training" && <span className="ml-2 font-normal normal-case tracking-normal">Blocking these is a common choice</span>}
        </th>
      </tr>
      {AI_BOTS.filter((b) => b.role === role).map((b) => {
        const r = result.bots.find((x) => x.token === b.token);
        const [robotsText, robotsClass] = ROBOTS[r?.robots ?? "unknown"];
        const [probe, probeClass] = probeText(r?.probe, r?.probeStatus);
        return (
          <tr key={b.token} className="border-b border-border last:border-b-0">
            <th scope="row" className="py-2 pr-3 text-left font-normal">
              <span className="font-medium text-foreground">{b.token}</span>
              <span className="block text-xs text-muted">{b.product}</span>
            </th>
            <td className={`py-2 pr-3 ${robotsClass}`}>{robotsText}</td>
            <td className={`py-2 ${probeClass}`}>{probe || <span className="text-muted">—</span>}</td>
          </tr>
        );
      })}
    </>
  );
}

/**
 * One row on a site's card: whether AI search tools can read the site. By default the full detail is a click away;
 * `compact` (the Overview) shows only the status and links to the AI visibility tab for the rest.
 */
export default function AiVisibilityRow({
  ai,
  compact = false,
  detailsHref = "/dashboard/ai-visibility",
}: {
  ai: NonNullable<Monitor["ai"]>;
  compact?: boolean;
  /** Where "See details" goes, in compact mode. */
  detailsHref?: string;
}) {
  const result = ai.result;
  const status: AiStatus | "pending" = result ? result.status : ai.status === "pending" ? "pending" : (ai.status as AiStatus);
  const headline = HEADLINE[status] ?? HEADLINE.pending;
  const problems = result?.findings.filter((f) => f.severity === "problem") ?? [];
  const notices = result?.findings.filter((f) => f.severity === "notice") ?? [];

  let summary: React.ReactNode = null;
  if (result?.status === "problem") summary = problems.map((p) => p.title).join(" · ");
  else if (result?.status === "attention") summary = `${notices.length} ${notices.length === 1 ? "suggestion" : "suggestions"} to make it easier for AI tools to read`;
  else if (result?.status === "ok") summary = "ChatGPT search, Claude, Perplexity and Google can reach this site";
  else if (result?.status === "unknown") summary = result.error;

  return (
    <div className="grid grid-cols-[5.5rem_1fr] gap-3 py-3 text-sm sm:grid-cols-[7rem_1fr]">
      <dt className="text-muted">AI search</dt>
      <dd className="min-w-0">
        <p className={`font-medium ${TEXT[headline.tone]}`}>{headline.text}</p>
        {summary && <div className="mt-0.5 break-words text-muted">{summary}</div>}
        {compact && result && (
          <Link href={detailsHref} className="mt-1 inline-block text-xs text-accent underline underline-offset-2 hover:opacity-80">
            See details
          </Link>
        )}
        {!compact && result && (
          <details className="group mt-2">
            <summary className="inline-block cursor-pointer text-xs text-accent underline underline-offset-2 hover:opacity-80">
              <span className="group-open:hidden">Show details</span>
              <span className="hidden group-open:inline">Hide details</span>
            </summary>
            <Details result={result} />
            <p className="mt-2 text-xs text-muted">Checked {ago(ai.checkedAt)}. Checked again every day.</p>
          </details>
        )}
      </dd>
    </div>
  );
}
