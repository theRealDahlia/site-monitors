"use client";

import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import type { Quote } from "@/lib/plan-change";
import { PLANS } from "@/lib/plans";

interface Data {
  plan: { id: string; name: string };
  limit: number;
  monitors: unknown[];
}

const money = (cents: number, currency: string) => (cents / 100).toLocaleString("en-US", { style: "currency", currency: currency.toUpperCase() });
const planName = (id: string) => PLANS.find((p) => p.name.toLowerCase() === id)?.name ?? id;

interface Billing {
  configured: boolean;
  canManage: boolean;
  hasSubscription: boolean;
  hasCustomer: boolean;
}

/** The in-app Plans page: which plan you're on, how much of it you're using, and the other plans. */
export default function Plans({ children }: { children?: React.ReactNode }) {
  const router = useRouter();
  const [data, setData] = useState<Data | null>(null);
  const [billing, setBilling] = useState<Billing | null>(null);
  const [loadError, setLoadError] = useState(false);
  const [busy, setBusy] = useState<string | null>(null);
  const [payError, setPayError] = useState<string | null>(null);
  // "success" or "cancelled" when Stripe has just sent the person back here.
  const [returned, setReturned] = useState<string | null>(null);
  // A change between paid plans waiting for the person to agree to the amounts, and how the last one went.
  const [change, setChange] = useState<Quote | null>(null);
  const [changed, setChanged] = useState<string | null>(null);
  const [reloadKey, setReloadKey] = useState(0);
  const changePanel = useRef<HTMLElement>(null);

  useEffect(() => {
    let cancelled = false;
    const back = new URLSearchParams(window.location.search).get("billing");
    const load = () =>
      Promise.all([fetch("/api/monitors", { cache: "no-store" }), fetch("/api/billing", { cache: "no-store" })])
        .then(async ([plan, bill]) => {
          if (cancelled) return null;
          if (plan.status === 401) return void router.replace("/login?next=%2Fdashboard%2Fplans");
          if (!plan.ok) return void setLoadError(true);
          const next: Data = await plan.json();
          setReturned(back);
          setData(next);
          if (bill.ok) setBilling(await bill.json());
          return next;
        })
        .catch(() => void (!cancelled && setLoadError(true)));

    if (back === "success") {
      // The plan changes when Stripe's message reaches us, which can be a few seconds after the payment page closes.
      (async () => {
        for (let i = 0; i < 8 && !cancelled; i++) {
          const next = await load();
          if (next && next.plan.id !== "free") break;
          await new Promise((r) => setTimeout(r, 2000));
        }
      })();
    } else {
      load();
    }
    return () => {
      cancelled = true;
    };
  }, [router, reloadKey]);

  useEffect(() => {
    if (change) changePanel.current?.focus();
  }, [change]);

  /** Sends the browser to Stripe: its payment page for a plan, or its billing portal for someone who already pays. */
  async function go(action: "checkout" | "portal", plan?: string) {
    setBusy(plan ?? action);
    setPayError(null);
    try {
      const res = await fetch(`/api/billing/${action}`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ plan }) });
      const body = await res.json().catch(() => ({}));
      if (res.ok && body.url) {
        window.location.assign(body.url);
        return;
      }
      setPayError(body.error ?? "Something went wrong. Please try again.");
    } catch {
      setPayError("Couldn't reach the server. Check your connection and try again.");
    }
    setBusy(null);
  }

  /** Asks what moving to another paid plan would cost and refund, so the person can agree to it before anything happens. */
  async function startChange(plan: string) {
    setBusy(plan);
    setPayError(null);
    setChanged(null);
    try {
      const res = await fetch("/api/billing/change", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ plan }) });
      const body = await res.json().catch(() => ({}));
      if (res.ok && body.quote) setChange(body.quote);
      else setPayError(body.error ?? "Something went wrong. Please try again.");
    } catch {
      setPayError("Couldn't reach the server. Check your connection and try again.");
    }
    setBusy(null);
  }

  async function confirmChange() {
    if (!change) return;
    setBusy("confirm");
    setPayError(null);
    try {
      const res = await fetch("/api/billing/change", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ plan: change.toPlan, confirm: true, expect: { refundCents: change.refundCents, chargeCents: change.chargeCents } }),
      });
      const body = await res.json().catch(() => ({}));
      if (res.ok) {
        setChanged(
          body.refundProblem
            ? `You're now on ${planName(change.toPlan)}. We couldn't send your refund automatically, so we'll sort it out and email you.`
            : body.refundedCents > 0
              ? `You're now on ${planName(change.toPlan)}. ${money(body.refundedCents, change.currency)} is on its way back to your card.`
              : `You're now on ${planName(change.toPlan)}.`,
        );
        setChange(null);
        setReloadKey((k) => k + 1);
      } else {
        // The amounts moved (a day ticked over): show the new ones to agree to.
        if (body.quote) setChange(body.quote);
        setPayError(body.error ?? "Something went wrong. Please try again.");
      }
    } catch {
      setPayError("Couldn't reach the server. Check your connection and try again.");
    }
    setBusy(null);
  }

  const canBuy = billing?.canManage && billing.configured;
  // Plans are listed cheapest first, so one before the current plan is a step down.
  const currentIndex = PLANS.findIndex((p) => p.name === data?.plan.name);

  return (
    <div>
      <h1 className="text-3xl font-semibold tracking-tight">Plans</h1>
      <p className="mt-2 text-muted">See what your plan includes, and what the others add.</p>

      {loadError && (
        <p role="alert" className="mt-6 rounded-lg bg-warn-bg px-4 py-3 text-sm text-warn">
          Couldn&apos;t load your plan. Check your connection.
        </p>
      )}

      {returned === "success" && (
        <p role="status" className="mt-6 rounded-lg bg-ok-bg px-4 py-3 text-sm text-ok">
          Thanks! Your payment went through. Your new plan switches on within a few seconds.
        </p>
      )}
      {returned === "cancelled" && (
        <p role="status" className="mt-6 rounded-lg border border-border px-4 py-3 text-sm text-muted">
          You didn&apos;t finish paying, so nothing changed and you haven&apos;t been charged.
        </p>
      )}
      {changed && (
        <p role="status" className="mt-6 rounded-lg bg-ok-bg px-4 py-3 text-sm text-ok">
          {changed}
        </p>
      )}
      {change && (
        <section ref={changePanel} tabIndex={-1} aria-labelledby="change-heading" className="mt-6 rounded-xl border border-accent bg-surface p-5 outline-none">
          <h2 id="change-heading" className="font-semibold">
            {change.toPlan === "free" ? `Cancel ${planName(change.fromPlan)} and switch to Free now` : `Switch from ${planName(change.fromPlan)} to ${planName(change.toPlan)} now`}
          </h2>
          <ul className="mt-3 list-disc space-y-1.5 pl-5 text-sm">
            {change.refundCents > 0 && (
              <li>
                We refund <span className="font-medium">{money(change.refundCents, change.currency)}</span> to your card for the {change.daysRemaining} unused{" "}
                {change.daysRemaining === 1 ? "day" : "days"} of {planName(change.fromPlan)} (of {change.daysTotal}).
              </li>
            )}
            {change.toPlan === "free" ? (
              <>
                <li>You won&apos;t be charged again.</li>
                <li>Your account moves to the Free plan straight away, and anything above its limits stops working until you&apos;re within them.</li>
              </>
            ) : (
              <>
                <li>
                  We charge <span className="font-medium">{money(change.chargeCents, change.currency)}</span> today for {planName(change.toPlan)}.
                </li>
                <li>Your new plan starts straight away, and your monthly billing date becomes today.</li>
              </>
            )}
          </ul>
          <div className="mt-4 flex flex-wrap items-center gap-3">
            <button
              type="button"
              onClick={confirmChange}
              disabled={busy !== null}
              className="rounded-lg bg-accent px-4 py-2 text-sm font-medium text-accent-foreground transition-opacity hover:opacity-90 disabled:opacity-50"
            >
              {busy === "confirm" ? (change.toPlan === "free" ? "Cancelling…" : "Changing plan…") : change.toPlan === "free" ? "Cancel and switch to Free" : `Switch to ${planName(change.toPlan)}`}
            </button>
            <button
              type="button"
              onClick={() => setChange(null)}
              disabled={busy !== null}
              className="rounded-lg border border-border px-4 py-2 text-sm hover:bg-border/40 disabled:opacity-50"
            >
              Keep {planName(change.fromPlan)}
            </button>
          </div>
        </section>
      )}
      {payError && (
        <p role="alert" className="mt-6 rounded-lg bg-warn-bg px-4 py-3 text-sm text-warn">
          {payError}
        </p>
      )}
      {billing && !billing.canManage && (
        <p className="mt-6 rounded-lg border border-border px-4 py-3 text-sm text-muted">Only the account owner can change the plan.</p>
      )}

      {data && (
        <section className="mt-6 rounded-xl border border-accent bg-surface p-5" aria-labelledby="current-plan">
          <p className="text-sm text-muted">Your plan</p>
          <h2 id="current-plan" className="mt-1 text-2xl font-semibold tracking-tight">
            {data.plan.name}
          </h2>
          {billing?.canManage && billing.hasCustomer && (
            <button
              type="button"
              onClick={() => go("portal")}
              disabled={busy !== null}
              className="mt-3 rounded-lg border border-border px-3 py-1.5 text-sm font-medium transition-colors hover:bg-border/40 disabled:opacity-60"
            >
              {busy === "portal" ? "Opening billing…" : "Manage billing"}
            </button>
          )}
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
                  ) : !p.available ? (
                    <button type="button" disabled className="w-full cursor-not-allowed rounded-lg border border-border px-4 py-2.5 text-sm text-muted">
                      Coming soon
                    </button>
                  ) : p.price === 0 ? (
                    // Going back to Free means cancelling now, with the unused days refunded (see /api/billing/change).
                    <button
                      type="button"
                      onClick={() => startChange("free")}
                      disabled={!canBuy || !billing?.hasSubscription || busy !== null}
                      className="w-full rounded-lg border border-border px-4 py-2.5 text-sm font-medium transition-colors hover:bg-border/40 disabled:cursor-not-allowed disabled:text-muted disabled:hover:bg-transparent"
                    >
                      {busy === "free" ? "Checking…" : "Cancel subscription"}
                    </button>
                  ) : (
                    <button
                      type="button"
                      onClick={() => (billing?.hasSubscription ? startChange(p.name.toLowerCase()) : go("checkout", p.name.toLowerCase()))}
                      disabled={!canBuy || busy !== null}
                      className="w-full rounded-lg bg-accent px-4 py-2.5 text-sm font-medium text-accent-foreground transition-opacity hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-50"
                    >
                      {busy === p.name.toLowerCase() ? (billing?.hasSubscription ? "Checking…" : "Opening payment…") : PLANS.indexOf(p) < currentIndex ? `Switch to ${p.name}` : billing?.hasSubscription ? `Switch to ${p.name}` : `Upgrade to ${p.name}`}
                    </button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
        <p className="mt-3 text-sm text-muted">
          Prices are in US dollars, billed monthly by card through Stripe. Change plan, update your card or cancel any time from Manage billing.
        </p>
      </section>

      {children}
    </div>
  );
}
