"use client";

import { useRouter } from "next/navigation";
import { useCallback, useEffect, useState } from "react";
import type { monitorView, OverallStatus } from "@/lib/monitor-view";

export type Monitor = ReturnType<typeof monitorView>;
export interface EventItem {
  id: number;
  host: string;
  kind: string;
  message: string;
  details: string | null;
  emailed: boolean;
  at: number;
}
export interface MonitorData {
  email: string;
  plan: { id: string; name: string; statusPages: boolean; integrations: boolean; aiVisibility: boolean };
  limit: number;
  monitors: Monitor[];
  events: EventItem[];
}

// ---------- formatting ----------

export function ago(ms: number | null): string {
  if (!ms) return "never";
  const secs = Math.max(0, Math.round((Date.now() - ms) / 1000));
  if (secs < 45) return "just now";
  const mins = Math.round(secs / 60);
  if (mins < 60) return `${mins} min ago`;
  const hours = Math.round(mins / 60);
  if (hours < 24) return `${hours} hr ago`;
  return `${Math.round(hours / 24)} days ago`;
}

export const day = (ms: number | null) =>
  ms ? new Date(ms).toLocaleDateString(undefined, { year: "numeric", month: "short", day: "numeric" }) : "unknown";

export const daysText = (days: number | null) =>
  days === null ? "" : days < 0 ? `Expired ${Math.abs(days)} days ago` : days === 1 ? "1 day left" : `${days} days left`;

export const BADGE: Record<OverallStatus, { label: string; classes: string }> = {
  ok: { label: "All good", classes: "bg-ok-bg text-ok" },
  warning: { label: "Needs attention soon", classes: "bg-warn-bg text-warn" },
  problem: { label: "Problem", classes: "bg-bad-bg text-bad" },
  down: { label: "Down", classes: "bg-bad-bg text-bad" },
  pending: { label: "Checking…", classes: "bg-surface text-muted border border-border" },
};

export function StatusBadge({ status }: { status: OverallStatus }) {
  const badge = BADGE[status];
  return <span className={`rounded-full px-3 py-1 text-sm font-medium ${badge.classes}`}>{badge.label}</span>;
}

// ---------- data ----------

type FetchResult = { kind: "ok"; data: MonitorData } | { kind: "unauthorized" } | { kind: "error" };

async function fetchMonitors(): Promise<FetchResult> {
  try {
    const res = await fetch("/api/monitors");
    if (res.status === 401) return { kind: "unauthorized" };
    if (!res.ok) return { kind: "error" };
    return { kind: "ok", data: await res.json() };
  } catch {
    return { kind: "error" };
  }
}

/**
 * Loads the signed-in user's monitors and keeps them fresh while the page is open. Logged-out
 * visitors are sent to the login page and brought back to `returnTo` afterwards.
 */
export function useMonitors(returnTo: string) {
  const router = useRouter();
  const [data, setData] = useState<MonitorData | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);

  // Results are applied in one place so the polling effect only sets state from a promise callback.
  const apply = useCallback(
    (result: FetchResult) => {
      if (result.kind === "unauthorized") {
        router.replace(`/login?next=${encodeURIComponent(returnTo)}`);
      } else if (result.kind === "ok") {
        setData(result.data);
        setLoadError(null);
      } else {
        setLoadError("Couldn't load your monitors. Check your connection.");
      }
    },
    [router, returnTo],
  );

  const reload = useCallback(async () => apply(await fetchMonitors()), [apply]);

  useEffect(() => {
    let cancelled = false;
    const run = () => {
      fetchMonitors().then((r) => !cancelled && apply(r));
    };
    run();
    const t = setInterval(run, 30_000);
    return () => {
      cancelled = true;
      clearInterval(t);
    };
  }, [apply]);

  return { data, loadError, reload };
}

/**
 * A short-lived message, like "Checked just now. Try again in 28s." One that names a wait counts down by itself and
 * disappears when the wait is over; any other message clears after a few seconds.
 */
export function useNotice() {
  const [notice, setNotice] = useState<string | null>(null);

  useEffect(() => {
    if (!notice) return;
    const wait = /^(.*Try again in )(\d+)s\.$/.exec(notice);
    const t = setTimeout(
      () => {
        if (!wait) return setNotice(null);
        const left = Number(wait[2]) - 1;
        setNotice(left > 0 ? `${wait[1]}${left}s.` : null);
      },
      wait ? 1000 : 8000,
    );
    return () => clearTimeout(t);
  }, [notice]);

  return [notice, setNotice] as const;
}
