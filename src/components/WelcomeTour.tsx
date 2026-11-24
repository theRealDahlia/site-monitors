"use client";

import Link from "next/link";
import { useCallback, useEffect, useRef, useState } from "react";
import { TOUR_STEPS } from "@/lib/tour";

const PRIMARY = "inline-flex items-center justify-center rounded-lg bg-accent px-4 py-2.5 text-sm font-medium text-accent-foreground hover:opacity-90";
const SECONDARY = "inline-flex items-center justify-center rounded-lg border border-border px-4 py-2.5 text-sm font-medium text-muted hover:border-accent hover:text-foreground";

/** Tells the server this person has seen the tour, so it isn't shown again at their next login. Best effort: a failure only means they'll see it once more. */
function markSeen() {
  fetch("/api/account/tour", { method: "POST" }).catch(() => {});
}

/**
 * The short tour shown the first time someone logs in, and again whenever they ask for it from the Getting started page.
 * It's a dialog: focus stays inside it, Escape skips it, and the page behind doesn't scroll.
 */
export default function WelcomeTour({ onClose }: { onClose: () => void }) {
  const [index, setIndex] = useState(0);
  const dialog = useRef<HTMLDivElement>(null);
  const heading = useRef<HTMLHeadingElement>(null);
  const step = TOUR_STEPS[index];
  const last = index === TOUR_STEPS.length - 1;

  const close = useCallback(() => {
    markSeen();
    onClose();
  }, [onClose]);

  // On opening, remember what had focus so it can go back there; lock the page behind; Escape skips; Tab stays inside.
  useEffect(() => {
    const before = document.activeElement as HTMLElement | null;
    document.body.style.overflow = "hidden";
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") return close();
      if (e.key !== "Tab" || !dialog.current) return;
      const items = [...dialog.current.querySelectorAll<HTMLElement>("a[href], button:not([disabled])")];
      if (items.length === 0) return;
      const first = items[0];
      const end = items[items.length - 1];
      if (e.shiftKey && document.activeElement === first) {
        e.preventDefault();
        end.focus();
      } else if (!e.shiftKey && document.activeElement === end) {
        e.preventDefault();
        first.focus();
      }
    };
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = "";
      before?.focus?.();
    };
  }, [close]);

  // Each step starts with its heading focused, so a screen reader reads the new step and keyboard users stay in place.
  useEffect(() => {
    heading.current?.focus();
  }, [index]);

  return (
    <div className="fixed inset-0 z-40 flex items-end justify-center p-0 sm:items-center sm:p-4">
      <div className="absolute inset-0 bg-black/50" onClick={close} aria-hidden />
      <div
        ref={dialog}
        role="dialog"
        aria-modal="true"
        aria-labelledby="tour-title"
        className="relative flex max-h-[90vh] w-full max-w-lg flex-col overflow-y-auto rounded-t-2xl border border-border bg-surface p-6 shadow-xl sm:rounded-2xl"
      >
        <div className="flex items-center justify-between gap-4">
          <p className="text-xs font-medium uppercase tracking-wide text-muted" aria-live="polite">
            Step {index + 1} of {TOUR_STEPS.length}
          </p>
          <button type="button" onClick={close} className="rounded-md px-2 py-1 text-sm text-muted hover:text-foreground">
            Skip tour
          </button>
        </div>

        <h2 id="tour-title" ref={heading} tabIndex={-1} className="mt-4 text-2xl font-semibold tracking-tight outline-none">
          {step.title}
        </h2>
        {step.menu && (
          <p className="mt-2 text-sm text-muted">
            In the menu: <span className="rounded-md bg-accent/10 px-2 py-0.5 font-medium text-accent">{step.menu}</span>
          </p>
        )}
        <div className="mt-4 space-y-3 text-sm leading-relaxed text-foreground/90">
          {step.paragraphs.map((p) => (
            <p key={p}>{p}</p>
          ))}
        </div>

        <div className="mt-6 flex justify-center gap-1.5" aria-hidden>
          {TOUR_STEPS.map((s, i) => (
            <span key={s.id} className={`h-1.5 rounded-full ${i === index ? "w-6 bg-accent" : "w-1.5 bg-border"}`} />
          ))}
        </div>

        <div className="mt-6 flex flex-wrap items-center justify-between gap-3">
          <button type="button" onClick={() => setIndex(index - 1)} disabled={index === 0} className={`${SECONDARY} disabled:invisible`}>
            Back
          </button>
          {last ? (
            <div className="flex flex-wrap justify-end gap-2">
              <Link href="/dashboard/getting-started" onClick={close} className={SECONDARY}>
                Read the full guide
              </Link>
              <Link href="/dashboard/sites#add" onClick={close} className={PRIMARY}>
                Add your first site
              </Link>
            </div>
          ) : (
            <button type="button" onClick={() => setIndex(index + 1)} className={PRIMARY}>
              Next
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
