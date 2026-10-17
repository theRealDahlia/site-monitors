"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { PLANS } from "@/lib/plans";

interface Data {
  plan: { id: string; name: string };
  limit: number;
  monitors: unknown[];
}

/** The in-app Plans page: which plan you're on, how much of it you're using, and the other plans. */
export default function Plans({ children }: { children?: React.ReactNode }) {
  const router = useRouter();
  const [data, setData] = useState<Data | null>(null);
  const [loadError, setLoadError] = useState(false);

  useEffect(() => {
    let cancelled = false;
    fetch("/api/monitors", { cache: "no-store" })
      .then(async (res) => {
        if (cancelled) return;
        if (res.status === 401) return router.replace("/login?next=%2Fdashboard%2Fplans");
        if (!res.ok) return setLoadError(true);
        setData(await res.json());
      })
      .catch(() => !cancelled && setLoadError(true));
    return () => {
      cancelled = true;
    };
  }, [router]);

  return (
    <div>
      <h1 className="text-3xl font-semibold tracking-tight">Plans</h1>
      <p className="mt-2 text-muted">See what your plan includes, and what the others add.</p>

      {loadError && (
        <p role="alert" className="mt-6 rounded-lg bg-warn-bg px-4 py-3 text-sm text-warn">
          Couldn&apos;t load your plan. Check your connection.
        </p>
      )}

      {data && (
        <section className="mt-6 rounded-xl border border-accent bg-surface p-5" aria-labelledby="current-plan">
          <p className="text-sm text-muted">Your plan</p>
          <h2 id="current-plan" className="mt-1 text-2xl font-semibold tracking-tight">
            {data.plan.name}
          </h2>
          <div className="mt-4">
            <div className="flex justify-between text-sm">
              <span className="text-muted">Sites watched</span>
              <span className="font-medium">
                {data.monitors.length} of {data.limit}
              </span>
            </div>
            <div className="mt-1.5 h-2 overflow-hidden rounded-full bg-border" aria-hidden>
              <div className="h-full rounded-full bg-accent" style={{ width: `${Math.min(100, (data.monitors.length / data.limit) * 100)}%` }} />
            </div>
          </div>
        </section>
      )}

      <section aria-labelledby="all-plans" className="mt-8">
        <h2 id="all-plans" className="font-semibold">
          All plans
        </h2>
        <div className="mt-3 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          {PLANS.map((p) => {
            const current = data?.plan.name === p.name;
            return (
              <div key={p.name} className={`flex flex-col rounded-xl border bg-surface p-5 ${current ? "border-accent" : "border-border"}`}>
                <div className="flex items-center justify-between gap-2">
                  <h3 className="text-lg font-semibold">{p.name}</h3>
                  {current && <span className="rounded-full bg-accent/10 px-2.5 py-0.5 text-xs font-medium text-accent">Current</span>}
                </div>
                <p className="mt-3 text-3xl font-semibold tracking-tight">
                  ${p.price}
                  <span className="text-base font-normal text-muted"> /month</span>
                </p>
                <ul className="mt-4 flex-1 space-y-2 text-sm">
                  {p.features.map((f) => (
                    <li key={f} className="flex gap-2">
                      <span aria-hidden className="text-ok">
                        ✓
                      </span>
                      <span>{f}</span>
                    </li>
                  ))}
                </ul>
                <div className="mt-5">
                  {current ? (
                    <p className="rounded-lg border border-accent/40 px-4 py-2.5 text-center text-sm text-accent">Your current plan</p>
                  ) : (
                    // Switching plans arrives with billing. Until then nobody can change their own plan.
                    <button type="button" disabled className="w-full cursor-not-allowed rounded-lg border border-border px-4 py-2.5 text-sm text-muted">
                      Coming soon
                    </button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
        <p className="mt-3 text-sm text-muted">
          Prices are in US dollars. Switching plans will be available here soon. What the paid plans include and cost may change before then.
        </p>
      </section>

      {children}
    </div>
  );
}
