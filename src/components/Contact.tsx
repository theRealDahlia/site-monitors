"use client";

import { useState } from "react";

/** The Contact page: a form that sends a question or concern to our contact inbox. */
export default function Contact() {
  const [topic, setTopic] = useState("");
  const [message, setMessage] = useState("");
  const [sending, setSending] = useState(false);
  const [sent, setSent] = useState(false);
  const [contactError, setContactError] = useState<string | null>(null);

  async function contact(e: React.FormEvent) {
    e.preventDefault();
    setSending(true);
    setContactError(null);
    try {
      const res = await fetch("/api/account/contact", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ subject: topic, message }) });
      if (res.ok) {
        setSent(true);
        setTopic("");
        setMessage("");
      } else {
        setContactError((await res.json().catch(() => ({}))).error ?? "Something went wrong. Please try again.");
      }
    } catch {
      setContactError("Couldn't reach the server. Check your connection and try again.");
    }
    setSending(false);
  }

  return (
    <div>
      <h1 className="text-3xl font-semibold tracking-tight">Contact us</h1>
      <p className="mt-2 text-muted">Ask a question or tell us about a concern.</p>

      <section className="mt-6 rounded-xl border border-border bg-surface p-5" aria-labelledby="contact-us">
        <h2 id="contact-us" className="font-semibold">
          Send us a message
        </h2>
        <p className="mt-2 text-sm text-muted">We&apos;ll reply to the email address you signed up with.</p>
        <form onSubmit={contact} className="mt-4 space-y-4">
          <div>
            <label htmlFor="contact-subject" className="mb-1.5 block text-sm font-medium">
              Subject
            </label>
            <input
              id="contact-subject"
              type="text"
              required
              maxLength={150}
              value={topic}
              onChange={(e) => {
                setTopic(e.target.value);
                setSent(false);
              }}
              className="w-full max-w-lg rounded-lg border border-border bg-surface px-4 py-2.5 text-base outline-none focus:border-accent focus:ring-2 focus:ring-accent/30"
            />
          </div>
          <div>
            <label htmlFor="contact-message" className="mb-1.5 block text-sm font-medium">
              Message
            </label>
            <textarea
              id="contact-message"
              required
              rows={6}
              maxLength={5000}
              value={message}
              onChange={(e) => {
                setMessage(e.target.value);
                setSent(false);
              }}
              aria-describedby={contactError ? "contact-error" : undefined}
              className="w-full max-w-lg rounded-lg border border-border bg-surface px-4 py-2.5 text-base outline-none focus:border-accent focus:ring-2 focus:ring-accent/30"
            />
          </div>
          {contactError && (
            <p id="contact-error" role="alert" className="text-sm text-bad">
              {contactError}
            </p>
          )}
          {sent && (
            <p role="status" className="text-sm text-ok">
              Thanks, your message is on its way. We&apos;ll reply by email.
            </p>
          )}
          <button
            type="submit"
            disabled={sending || !topic.trim() || !message.trim()}
            className="rounded-lg bg-accent px-4 py-2 text-sm font-medium text-accent-foreground transition-opacity hover:opacity-90 disabled:opacity-50"
          >
            {sending ? "Sending…" : "Send message"}
          </button>
        </form>
      </section>
    </div>
  );
}
