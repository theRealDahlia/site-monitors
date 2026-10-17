"use client";

import { useState } from "react";

/**
 * Development-only admin tool: switches the admin's own account between plans, then reloads so every
 * page shows the new limits. The server refuses it for anyone else, and everywhere outside development.
 */
export default function PlanSwitcher({ plan, plans }: { plan: string; plans: { id: string; name: string }[] }) {
  const [switching, setSwitching] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function switchPlan(next: string) {
    if (switching || next === plan) return;
    setSwitching(true);
    setError(null);
    try {
      const res = await fetch("/api/admin/plan", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ plan: next }),
      });
      if (res.ok) {
        window.location.reload();
        return;
      }
      setError((await res.json()).error ?? "Couldn't switch plans.");
    } catch {
      setError("Couldn't reach the server.");
    }
    setSwitching(false);
  }

  return (
    <div role="group" aria-label="Admin plan switcher">
      <p className="text-xs font-medium text-accent">Admin · switch your plan</p>
      <div className="mt-2 grid grid-cols-2 gap-1.5">
        {plans.map((p) => (
          <button
            key={p.id}
            type="button"
            onClick={() => switchPlan(p.id)}
            disabled={switching}
            aria-pressed={plan === p.id}
            className={`rounded-md border px-2 py-1.5 text-sm disabled:opacity-60 ${
              plan === p.id ? "border-accent bg-accent/10 font-medium text-foreground" : "border-border text-muted hover:border-accent"
            }`}
          >
            {p.name}
          </button>
        ))}
      </div>
      {error && (
        <p role="alert" className="mt-2 text-xs text-bad">
          {error}
        </p>
      )}
    </div>
  );
}
