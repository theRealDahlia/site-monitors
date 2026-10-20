"use client";

import { type Monitor, ago, day, daysText } from "@/components/monitor-ui";

// How a site's checks read, shared by the Sites list (one short word per check) and a site's own page (the full rows).

export type Tone = "ok" | "warn" | "bad" | "muted";
export const TONE_TEXT: Record<Tone, string> = { ok: "text-ok", warn: "text-warn", bad: "text-bad", muted: "text-muted" };

// ---------- the full rows, on a site's own page ----------

export function Row({ label, tone, headline, detail }: { label: string; tone: Tone; headline: string; detail?: React.ReactNode }) {
  return (
    <div className="grid grid-cols-[5.5rem_1fr] gap-3 py-3 text-sm sm:grid-cols-[7rem_1fr]">
      <dt className="text-muted">{label}</dt>
      <dd className="min-w-0">
        {headline && <p className={`font-medium ${TONE_TEXT[tone]}`}>{headline}</p>}
        {detail && <div className={`${headline ? "mt-0.5" : ""} break-words text-muted`}>{detail}</div>}
      </dd>
    </div>
  );
}

export function UptimeRow({ m }: { m: Monitor }) {
  const u = m.uptime;
  if (u.status === "pending") return <Row label="Uptime" tone="muted" headline="Not checked yet" />;
  if (u.status === "down") {
    return <Row label="Uptime" tone="bad" headline="Down" detail={`${u.error ?? "No response"}${u.downSince ? ` · since ${ago(u.downSince)}` : ""}`} />;
  }
  const pct = [u.pct24h !== null && `${u.pct24h}% over 24h`, u.pct30d !== null && `${u.pct30d}% over 30 days`].filter(Boolean).join(" · ");
  return <Row label="Uptime" tone="ok" headline="Up" detail={`HTTP ${u.code ?? "?"} · ${u.ms ?? "?"} ms${pct ? ` · ${pct}` : ""}`} />;
}

export function SslRow({ m }: { m: Monitor }) {
  const s = m.ssl;
  switch (s.status) {
    case "pending":
      return <Row label="SSL" tone="muted" headline="Not checked yet" />;
    case "unreachable":
      return <Row label="SSL" tone="muted" headline="Couldn't check" detail={s.error ?? "Couldn't connect."} />;
    case "invalid":
      return (
        <Row
          label="SSL"
          tone="bad"
          headline="Problem with certificate"
          detail={
            <ul className="list-inside list-disc">
              {s.problems.map((p) => (
                <li key={p}>{p}</li>
              ))}
            </ul>
          }
        />
      );
    default: {
      const tone = s.status === "valid" ? "ok" : s.status === "expiring" ? "warn" : "bad";
      return <Row label="SSL" tone={tone} headline={daysText(s.days)} detail={`Expires ${day(s.expiresAt)}${s.issuer ? ` · issued by ${s.issuer}` : ""}`} />;
    }
  }
}

export function DomainRow({ m }: { m: Monitor }) {
  const d = m.domain;
  switch (d.status) {
    case "pending":
      return <Row label="Domain" tone="muted" headline="Not checked yet" />;
    case "unsupported":
      return <Row label="Domain" tone="muted" headline="Expiry unavailable" detail="This domain extension doesn't publish its expiry date publicly." />;
    case "unknown":
      return <Row label="Domain" tone="muted" headline="Expiry not published" detail={d.name ?? undefined} />;
    case "error":
      return <Row label="Domain" tone="muted" headline="Couldn't check" detail={d.note ?? undefined} />;
    default: {
      const tone = d.status === "ok" ? "ok" : d.status === "expiring" ? "warn" : "bad";
      return (
        <Row
          label="Domain"
          tone={tone}
          headline={daysText(d.days)}
          detail={`${d.name ?? m.host} expires ${day(d.expiresAt)}${d.registrar ? ` · ${d.registrar}` : ""}`}
        />
      );
    }
  }
}

// ---------- rows for monitors that aren't whole sites ----------

/** "5 minutes", "6 hours", "1 day", "week". */
export const intervalText = (ms: number | null) => {
  if (!ms) return "";
  const mins = Math.round(ms / 60_000);
  if (mins < 60) return `${mins} minute${mins === 1 ? "" : "s"}`;
  const hours = mins / 60;
  if (hours < 24) return `${hours} hour${hours === 1 ? "" : "s"}`;
  const days = hours / 24;
  return days === 7 ? "week" : `${days} day${days === 1 ? "" : "s"}`;
};

/** A page monitor: is it answering, and does its keyword rule hold. */
export function PageRows({ m }: { m: Monitor }) {
  const u = m.uptime;
  const t = m.target;
  const keywordRule = t.keyword ? `Must ${t.keywordMode === "absent" ? "not contain" : "contain"} “${t.keyword}”` : null;
  const status =
    u.status === "pending" ? (
      <Row label="Status" tone="muted" headline="Not checked yet" />
    ) : u.status === "down" ? (
      <Row label="Status" tone="bad" headline="Down" detail={`${u.error ?? "No response"}${u.downSince ? ` · since ${ago(u.downSince)}` : ""}`} />
    ) : (
      <Row label="Status" tone="ok" headline="Up" detail={`HTTP ${u.code ?? "?"} · ${u.ms ?? "?"} ms${u.pct24h !== null ? ` · ${u.pct24h}% over 24h` : ""}`} />
    );
  return (
    <>
      {status}
      <Row label="Address" tone="muted" headline="" detail={<span className="break-all">{t.url}</span>} />
      {keywordRule && <Row label="Keyword" tone="muted" headline="" detail={keywordRule} />}
    </>
  );
}

/** A port monitor: does it accept connections. */
export function PortRow({ m }: { m: Monitor }) {
  const u = m.uptime;
  const label = `Port ${m.target.port}`;
  if (u.status === "pending") return <Row label={label} tone="muted" headline="Not checked yet" detail={m.target.server ?? undefined} />;
  if (u.status === "down") return <Row label={label} tone="bad" headline="Closed or not answering" detail={`${u.error ?? "No answer"}${u.downSince ? ` · since ${ago(u.downSince)}` : ""}`} />;
  return <Row label={label} tone="ok" headline="Open" detail={`${m.target.server} answered in ${u.ms ?? "?"} ms${u.pct24h !== null ? ` · ${u.pct24h}% over 24h` : ""}`} />;
}

/** A heartbeat: when it last checked in, and when it's next expected. */
export function HeartbeatRows({ m }: { m: Monitor }) {
  const h = m.target.heartbeat;
  if (!h) return null;
  const u = m.uptime;
  const expected = `Every ${intervalText(h.everyMs)}, up to ${intervalText(h.graceMs)} late`;
  return (
    <>
      {u.status === "down" ? (
        <Row label="Check-ins" tone="bad" headline="Overdue" detail={u.error ?? undefined} />
      ) : h.lastPing ? (
        <Row label="Check-ins" tone="ok" headline="On time" detail={`Last check-in ${ago(h.lastPing)} · next expected by ${new Date(h.deadline).toLocaleString(undefined, { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" })}`} />
      ) : (
        <Row label="Check-ins" tone="muted" headline="Waiting for the first check-in" detail={`Expected by ${new Date(h.deadline).toLocaleString(undefined, { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" })}`} />
      )}
      <Row label="Schedule" tone="muted" headline="" detail={expected} />
    </>
  );
}

// ---------- one short word per check, for lists ----------

export interface Brief {
  tone: Tone;
  text: string;
}

const shortDays = (days: number | null) => (days === null ? "—" : days < 0 ? "Expired" : `${days} days`);

export function uptimeBrief(m: Monitor): Brief {
  const u = m.uptime;
  if (m.kind === "heartbeat") {
    if (u.status === "down") return { tone: "bad", text: "Overdue" };
    return m.target.heartbeat?.lastPing ? { tone: "ok", text: "On time" } : { tone: "muted", text: "Waiting" };
  }
  if (u.status === "pending") return { tone: "muted", text: "Checking" };
  if (u.status === "down") return { tone: "bad", text: "Down" };
  return { tone: "ok", text: u.pct24h !== null ? `Up · ${u.pct24h}%` : "Up" };
}

export function sslBrief(m: Monitor): Brief {
  const s = m.ssl;
  if (s.status === "pending") return { tone: "muted", text: "Checking" };
  if (s.status === "unreachable") return { tone: "muted", text: "Couldn't check" };
  if (s.status === "invalid") return { tone: "bad", text: "Problem" };
  return { tone: s.status === "valid" ? "ok" : s.status === "expiring" ? "warn" : "bad", text: shortDays(s.days) };
}

export function domainBrief(m: Monitor): Brief {
  const d = m.domain;
  if (d.status === "pending") return { tone: "muted", text: "Checking" };
  if (d.status === "unsupported" || d.status === "unknown") return { tone: "muted", text: "Not published" };
  if (d.status === "error") return { tone: "muted", text: "Couldn't check" };
  return { tone: d.status === "ok" ? "ok" : d.status === "expiring" ? "warn" : "bad", text: shortDays(d.days) };
}

const AI_BRIEF: Record<string, Brief> = {
  ok: { tone: "ok", text: "Readable" },
  attention: { tone: "warn", text: "Could be better" },
  problem: { tone: "bad", text: "Blocked" },
  unknown: { tone: "muted", text: "Couldn't tell" },
  pending: { tone: "muted", text: "Not checked yet" },
};

export function aiBrief(ai: NonNullable<Monitor["ai"]>): Brief {
  return AI_BRIEF[ai.result?.status ?? ai.status] ?? AI_BRIEF.pending;
}

/**
 * Why a site needs a look, in one line each, most serious first. Empty when everything is fine. Used by the Overview's
 * "Needs attention" list, so a problem is described the same way wherever it's summed up.
 */
export function attentionReasons(m: Monitor): Brief[] {
  const out: Brief[] = [];
  if (m.uptime.status === "down") {
    out.push({
      tone: "bad",
      text: m.kind === "heartbeat" ? `Missed its check-in: ${m.uptime.error ?? "no check-in"}` : `Down${m.uptime.downSince ? ` since ${ago(m.uptime.downSince)}` : ""}: ${m.uptime.error ?? "no response"}`,
    });
  }
  if (m.kind !== "site") return out;
  if (m.ssl.status === "invalid") out.push({ tone: "bad", text: `Certificate problem: ${m.ssl.problems[0] ?? "it isn't valid"}` });
  if (m.ssl.status === "expired") out.push({ tone: "bad", text: "SSL certificate has expired" });
  if (m.domain.status === "expired") out.push({ tone: "bad", text: "Domain registration has expired" });
  if (m.ai?.result?.status === "problem") out.push({ tone: "bad", text: "AI search tools are blocked or can't read it" });
  if (m.ssl.status === "expiring") out.push({ tone: "warn", text: `SSL certificate expires in ${m.ssl.days} days` });
  if (m.domain.status === "expiring") out.push({ tone: "warn", text: `Domain expires in ${m.domain.days} days` });
  return out;
}

/** The colour for a check's dot or word. */
export function Dot({ tone }: { tone: Tone }) {
  const bg = { ok: "bg-ok", warn: "bg-warn", bad: "bg-bad", muted: "bg-border" }[tone];
  return <span aria-hidden className={`inline-block h-2 w-2 shrink-0 rounded-full ${bg}`} />;
}
