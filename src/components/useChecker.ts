"use client";

import { useEffect, useState } from "react";

export interface Usage {
  used: number;
  limit: number;
  /** Signed-in accounts have no free-check limit. */
  signedIn: boolean;
}

/** Shared form state for the free checkers, including the free-check allowance. */
export function useChecker<T>(endpoint: string) {
  const [host, setHost] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<T | null>(null);
  const [usage, setUsage] = useState<Usage | null>(null);

  useEffect(() => {
    let cancelled = false;
    fetch("/api/usage")
      .then((r) => r.json())
      .then((u: Usage) => !cancelled && setUsage(u))
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, []);

  const limited = usage !== null && !usage.signedIn && usage.used >= usage.limit;

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!host.trim() || loading || limited) return;
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`${endpoint}?host=${encodeURIComponent(host)}`);
      const data = await res.json();
      if (data.usage) setUsage(data.usage);
      if (res.ok) {
        setResult(data);
      } else if (data.code !== "free_limit_reached") {
        setResult(null);
        setError(data.error ?? "Something went wrong.");
      }
    } catch {
      setResult(null);
      setError("Couldn't reach the checker. Check your connection and try again.");
    } finally {
      setLoading(false);
    }
  }

  return { host, setHost, loading, error, result, usage, limited, submit };
}
