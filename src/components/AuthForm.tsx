"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { safeNext } from "@/lib/safe-next";

type Mode = "login" | "signup";

const INPUT =
  "w-full rounded-lg border border-border bg-surface px-4 py-3 text-base outline-none placeholder:text-muted/70 focus:border-accent focus:ring-2 focus:ring-accent/30";
const PRIMARY =
  "w-full rounded-lg bg-accent px-6 py-3 text-base font-medium text-accent-foreground transition-opacity hover:opacity-90 disabled:opacity-50";

async function post(url: string, body: unknown) {
  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  return { ok: res.ok, data: await res.json().catch(() => ({})) };
}

// Where to go after logging in or signing up: the dashboard. The one exception is a visitor who was
// bounced to the login page from a specific dashboard page (/login?next=/dashboard/sites): they go back
// there. Anything else in `next` (a checker page, another site) is ignored.
const afterAuthUrl = () => {
  const next = safeNext(new URLSearchParams(window.location.search).get("next"));
  return next === "/dashboard" || next.startsWith("/dashboard/") ? next : "/dashboard";
};

// "replace" instead of "assign", so the login or sign-up page doesn't stay in the browser history
// for the Back button to return to.
const goAfterAuth = () => window.location.replace(afterAuthUrl());

function SwitchLink({ mode }: { mode: Mode }) {
  const target = mode === "signup" ? "/login" : "/signup";
  return (
    <p className="text-center text-sm text-muted">
      {mode === "signup" ? "Already have an account?" : "New here?"}{" "}
      <Link
        href={target}
        onClick={(e) => {
          e.preventDefault();
          const n = new URLSearchParams(window.location.search).get("next");
          window.location.assign(n ? `${target}?next=${encodeURIComponent(safeNext(n))}` : target);
        }}
        className="text-accent underline underline-offset-2"
      >
        {mode === "signup" ? "Log in" : "Create a free account"}
      </Link>
    </p>
  );
}

function ErrorMessage({ message }: { message: string | null }) {
  if (!message) return null;
  return (
    <p role="alert" className="rounded-lg bg-bad-bg px-4 py-3 text-sm text-bad">
      {message}
    </p>
  );
}

function LoginForm() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (loading) return;
    setLoading(true);
    setError(null);
    try {
      const { ok, data } = await post("/api/auth/login", { email, password });
      if (!ok) {
        setError(data.error ?? "Something went wrong.");
        setLoading(false);
        return;
      }
      // Full navigation so every page re-reads the new session.
      goAfterAuth();
    } catch {
      setError("Couldn't reach the server. Try again.");
      setLoading(false);
    }
  }

  return (
    <form onSubmit={onSubmit} className="space-y-4">
      <div>
        <label htmlFor="auth-email" className="mb-1.5 block text-sm font-medium">
          Email
        </label>
        <input
          id="auth-email"
          type="email"
          required
          autoComplete="email"
          autoFocus
          placeholder="you@agency.com"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          className={INPUT}
        />
      </div>
      <div>
        <label htmlFor="auth-password" className="mb-1.5 block text-sm font-medium">
          Password
        </label>
        <input
          id="auth-password"
          type="password"
          required
          maxLength={128}
          autoComplete="current-password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          className={INPUT}
        />
      </div>
      <ErrorMessage message={error} />
      <button type="submit" disabled={loading} className={PRIMARY}>
        {loading ? "Logging in…" : "Log in"}
      </button>
      <SwitchLink mode="login" />
    </form>
  );
}

/**
 * Sign-up in two steps. Step 1 emails a code; step 2 takes the code plus a password. The account
 * is only created once the code is right, so nobody can register an address they can't read.
 */
function SignupForm() {
  const [stage, setStage] = useState<"email" | "code">("email");
  const [email, setEmail] = useState("");
  const [code, setCode] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [cooldown, setCooldown] = useState(0);

  useEffect(() => {
    if (cooldown <= 0) return;
    const t = setTimeout(() => setCooldown((c) => c - 1), 1000);
    return () => clearTimeout(t);
  }, [cooldown]);

  async function sendCode(e?: React.FormEvent) {
    e?.preventDefault();
    if (loading) return;
    setLoading(true);
    setError(null);
    try {
      const { ok, data } = await post("/api/auth/signup/start", { email });
      if (ok) {
        setStage("code");
        setCode("");
        setCooldown(data.resendAfterSeconds ?? 60);
      } else {
        if (data.retryAfterSeconds) setCooldown(data.retryAfterSeconds);
        setError(data.error ?? "Something went wrong.");
      }
    } catch {
      setError("Couldn't reach the server. Try again.");
    }
    setLoading(false);
  }

  async function createAccount(e: React.FormEvent) {
    e.preventDefault();
    if (loading) return;
    setLoading(true);
    setError(null);
    try {
      const { ok, data } = await post("/api/auth/signup", { email, code, password });
      if (!ok) {
        setError(data.error ?? "Something went wrong.");
        if (data.code === "code_locked" || data.code === "code_expired") setCode("");
        setLoading(false);
        return;
      }
      goAfterAuth();
    } catch {
      setError("Couldn't reach the server. Try again.");
      setLoading(false);
    }
  }

  if (stage === "email") {
    return (
      <form onSubmit={sendCode} className="space-y-4">
        <div>
          <label htmlFor="auth-email" className="mb-1.5 block text-sm font-medium">
            Email
          </label>
          <input
            id="auth-email"
            type="email"
            required
            autoComplete="email"
            autoFocus
            placeholder="you@agency.com"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className={INPUT}
          />
          <p className="mt-1.5 text-xs text-muted">We&apos;ll email you a 6-digit code to confirm it&apos;s yours.</p>
        </div>
        <ErrorMessage message={error} />
        <button type="submit" disabled={loading} className={PRIMARY}>
          {loading ? "Sending code…" : "Send confirmation code"}
        </button>
        <SwitchLink mode="signup" />
      </form>
    );
  }

  return (
    <form onSubmit={createAccount} className="space-y-4">
      <p role="status" className="rounded-lg bg-ok-bg px-4 py-3 text-sm text-ok">
        We sent a 6-digit code to <span className="font-medium">{email}</span>. It expires in 10 minutes.
      </p>
      <div>
        <label htmlFor="auth-code" className="mb-1.5 block text-sm font-medium">
          Confirmation code
        </label>
        <input
          id="auth-code"
          type="text"
          inputMode="numeric"
          autoComplete="one-time-code"
          pattern="[0-9]{6}"
          maxLength={6}
          required
          autoFocus
          placeholder="123456"
          value={code}
          onChange={(e) => setCode(e.target.value.replace(/\D/g, ""))}
          className={`${INPUT} font-mono tracking-[0.4em]`}
        />
      </div>
      <div>
        <label htmlFor="auth-password" className="mb-1.5 block text-sm font-medium">
          Choose a password
        </label>
        <input
          id="auth-password"
          type="password"
          required
          minLength={8}
          maxLength={128}
          autoComplete="new-password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          className={INPUT}
        />
        <p className="mt-1.5 text-xs text-muted">At least 8 characters.</p>
      </div>
      <ErrorMessage message={error} />
      <button type="submit" disabled={loading || code.length !== 6} className={PRIMARY}>
        {loading ? "Creating account…" : "Create account"}
      </button>
      <p className="flex flex-wrap items-center justify-between gap-2 text-sm text-muted">
        <button
          type="button"
          onClick={() => sendCode()}
          disabled={loading || cooldown > 0}
          className="text-accent underline underline-offset-2 disabled:no-underline disabled:opacity-60"
        >
          {cooldown > 0 ? `Resend code in ${cooldown}s` : "Resend code"}
        </button>
        <button
          type="button"
          onClick={() => {
            setStage("email");
            setError(null);
            setCode("");
          }}
          className="text-accent underline underline-offset-2"
        >
          Use a different email
        </button>
      </p>
    </form>
  );
}

export default function AuthForm({ mode }: { mode: Mode }) {
  return mode === "login" ? <LoginForm /> : <SignupForm />;
}
