import { listRecipients } from "./alert-emails";
import { listChannels } from "./channels";
import { db } from "./db";
import { phoneTargets } from "./phones";

// Every place an alert can go, named the same way everywhere: "account" (the account's own address),
// "email:<id>" (an added address), "channel:<id>" (Slack or Discord) and "phone:<id>" (SMS or a call, see phones.ts).
// A monitor can send its alerts to only some of them, and the escalation rule names who to tell next.

export interface Target {
  id: string;
  kind: "email" | "slack" | "discord" | "sms" | "call";
  label: string;
  /** Switched on, and confirmed where that's needed. A target that isn't gets nothing, wherever it's chosen. */
  active: boolean;
}

export const MAX_TARGETS = 30;
const TARGET_RE = /^(account|(email|channel|phone):\d+)$/;

export function listTargets(userId: number): Target[] {
  const r = listRecipients(userId);
  const out: Target[] = [];
  if (r) {
    out.push({ id: "account", kind: "email", label: r.account.email, active: r.account.enabled });
    for (const e of r.extras) out.push({ id: `email:${e.id}`, kind: "email", label: e.email, active: e.enabled && e.confirmed });
  }
  for (const c of listChannels(userId)) out.push({ id: `channel:${c.id}`, kind: c.kind, label: c.name, active: c.enabled });
  out.push(...phoneTargets(userId));
  return out;
}

/** Reads a chosen list of destinations: each must be one of this account's. Null for "everyone". */
export function parseTargets(userId: number, input: unknown): { ok: true; value: string[] | null } | { ok: false; error: string } {
  if (input === null) return { ok: true, value: null };
  if (!Array.isArray(input) || input.length > MAX_TARGETS || !input.every((t) => typeof t === "string" && TARGET_RE.test(t))) {
    return { ok: false, error: "Choose who gets the alerts." };
  }
  const mine = new Set(listTargets(userId).map((t) => t.id));
  const chosen = [...new Set(input as string[])];
  if (chosen.length === 0) return { ok: false, error: "Choose at least one place for the alerts to go." };
  if (!chosen.every((t) => mine.has(t))) return { ok: false, error: "One of those isn't on your account any more. Reload the page and try again." };
  return { ok: true, value: chosen };
}

/** A stored list of destinations, or null for everyone. */
export function readTargets(json: string | null): Set<string> | null {
  if (!json) return null;
  try {
    const v = JSON.parse(json);
    return Array.isArray(v) ? new Set(v.filter((t) => typeof t === "string")) : null;
  } catch {
    return null;
  }
}

export function setMonitorTargets(monitorId: number, userId: number, targets: string[] | null): boolean {
  return Number(db().prepare("UPDATE monitors SET alert_targets = ? WHERE id = ? AND user_id = ?").run(targets ? JSON.stringify(targets) : null, monitorId, userId).changes) > 0;
}
