"use client";

/** The Getting started page's button for showing the welcome tour again. AppShell listens for the event and opens it. */
export const OPEN_TOUR_EVENT = "site-monitors:open-tour";

export default function ReplayTour() {
  return (
    <button
      type="button"
      onClick={() => window.dispatchEvent(new Event(OPEN_TOUR_EVENT))}
      className="inline-flex items-center rounded-lg bg-accent px-4 py-2.5 text-sm font-medium text-accent-foreground hover:opacity-90"
    >
      Take the tour
    </button>
  );
}
