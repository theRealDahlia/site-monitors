"use client";

import { useState, useSyncExternalStore } from "react";

const TEXT = {
  confirm: {
    heading: "Confirm website alerts",
    intro: "Someone added this email address to their Site Monitors alerts. Confirm to start getting emails when one of their sites goes down, or an SSL certificate or domain is about to expire.",
    button: "Confirm and start alerts",
    busy: "Confirming…",
    done: (email: string) => `Confirmed. ${email} will now get alerts. Every alert has a link to stop them.`,
  },
  stop: {
    heading: "Stop alert emails",
    intro: "Stop getting Site Monitors alerts at this address. The person who added it will see that it's been removed.",
    button: "Stop these emails",
    busy: "Stopping…",
    done: (email: string) => `Done. ${email} won't get any more alerts from this account.`,
  },
} as const;

/**
 * The page behind the links in our emails. It acts only when the button is pressed, never just by
 * opening the page, so a mail scanner that follows links can't confirm or remove anything.
 */
export default function EmailLinkAction({ mode }: { mode: "confirm" | "stop" }) {
  const t = TEXT[mode];
  // The token from the link's address. null while the page is first drawn on the server.
  const token = useSyncExternalStore(
    () => () => {},
    () => new URLSearchParams(window.location.search).get("token") ?? "",
    () => null,
  );
  const [state, setState] = useState<{ kind: "idle" | "busy" } | { kind: "done"; email: string } | { kind: "error"; text: string }>({ kind: "idle" });

  async function act() {
    setState({ kind: "busy" });
    try {
      const res = await fetch(`/api/alert-emails/${mode}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token }),
      });
      const body = await res.json();
      setState(res.ok ? { kind: "done", email: body.email } : { kind: "error", text: body.error ?? "Something went wrong." });
    } catch {
      setState({ kind: "error", text: "Couldn't reach the server. Try again." });
    }
  }

  return (
    <div>
      <h1 className="text-3xl font-semibold tracking-tight">{t.heading}</h1>
      {state.kind === "done" ? (
        <p role="status" className="mt-6 rounded-lg bg-ok-bg px-4 py-3 text-sm text-ok">
          {t.done(state.email)}
        </p>
      ) : token === "" ? (
        <p role="alert" className="mt-6 rounded-lg bg-bad-bg px-4 py-3 text-sm text-bad">
          This link is incomplete. Open it again from the email.
        </p>
      ) : (
        <>
          <p className="mt-3 text-muted">{t.intro}</p>
          {state.kind === "error" && (
            <p role="alert" className="mt-4 rounded-lg bg-bad-bg px-4 py-3 text-sm text-bad">
              {state.text}
            </p>
          )}
          <button
            type="button"
            onClick={act}
            disabled={token === null || state.kind === "busy"}
            className="mt-6 rounded-lg bg-accent px-6 py-3 text-base font-medium text-accent-foreground hover:opacity-90 disabled:opacity-50"
          >
            {state.kind === "busy" ? t.busy : t.button}
          </button>
        </>
      )}
    </div>
  );
}
