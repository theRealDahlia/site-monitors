"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { BrandMark, useBranding } from "@/components/branding-context";
import { ACCENTS, BRAND_NAME_MAX, type Branding, type ThemeMode, accentVars } from "@/lib/theme";

const MODES: { id: ThemeMode; label: string }[] = [
  { id: "system", label: "Match device" },
  { id: "light", label: "Light" },
  { id: "dark", label: "Dark" },
];
const MAX_KB = 300;
const BUTTON = "rounded-lg border border-border px-4 py-2 text-sm hover:border-accent hover:text-accent disabled:opacity-50";

type Status = { ok: boolean; text: string } | null;

/** What the Free plan sees instead: what the page would let them do, and where to get it. */
function Upsell() {
  return (
    <section className="mt-6 rounded-xl border border-border bg-surface p-5">
      <h2 className="font-semibold">Part of the Starter plan</h2>
      <ul className="mt-2 list-disc space-y-1 pl-5 text-sm text-muted">
        <li>Your logo and company name at the top of the menu and on your public status pages</li>
        <li>Light or dark mode, and an accent colour of your choice</li>
        <li>Your clients see your brand, not ours</li>
      </ul>
      <Link href="/dashboard/plans" className="mt-4 inline-block rounded-lg bg-accent px-4 py-2 text-sm font-medium text-accent-foreground hover:opacity-90">
        See the plans
      </Link>
    </section>
  );
}

/** The Appearance settings, shown on the Account page: the account's own logo, name, light or dark, and accent colour. Starter and up. */
export default function Appearance() {
  const { branding, setBranding, canBrand } = useBranding();
  // The name as it's being typed; null when it isn't being edited, so the saved name shows.
  const [nameDraft, setNameDraft] = useState<string | null>(null);
  const [nameBusy, setNameBusy] = useState(false);
  const [nameStatus, setNameStatus] = useState<Status>(null);
  const [logoStatus, setLogoStatus] = useState<Status>(null);
  const [themeStatus, setThemeStatus] = useState<Status>(null);
  const [uploading, setUploading] = useState(false);
  const fileInput = useRef<HTMLInputElement>(null);
  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const saved = useRef<Branding | null>(null);

  // The last look the server confirmed, to go back to if a save fails.
  useEffect(() => {
    if (branding && !saved.current) saved.current = branding;
  }, [branding]);

  useEffect(() => () => {
    if (saveTimer.current) clearTimeout(saveTimer.current);
  }, []);

  if (!branding) return <p className="text-muted">Loading…</p>;

  if (!canBrand) {
    return (
      <div className="mt-6">
        <h2 className="flex flex-wrap items-center gap-3 text-xl font-semibold tracking-tight">
          Appearance
          <span className="rounded-full border border-border px-2.5 py-0.5 text-sm font-medium text-muted">Starter</span>
        </h2>
        <p className="mt-1 text-sm text-muted">Make your dashboard, and the public status pages you share with clients, look like your company.</p>
        <Upsell />
      </div>
    );
  }

  const nameValue = nameDraft ?? branding.name ?? "";
  const nameChanged = nameDraft !== null && nameDraft.trim() !== (branding.name ?? "");

  async function saveName(e: React.FormEvent) {
    e.preventDefault();
    if (!branding || nameBusy || !nameChanged) return;
    setNameBusy(true);
    setNameStatus(null);
    try {
      const res = await fetch("/api/branding", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ mode: branding.mode, accent: branding.accent, name: nameValue }),
      });
      const body = await res.json();
      if (!res.ok) throw new Error(body.error ?? "Couldn't save.");
      saved.current = body;
      setBranding(body);
      setNameDraft(null);
      setNameStatus({ ok: true, text: body.name ? "Name saved." : "Name removed." });
    } catch (err) {
      setNameStatus({ ok: false, text: err instanceof Error && err.message !== "Failed to fetch" ? err.message : "Couldn't reach the server. Try again." });
    }
    setNameBusy(false);
  }

  /** Shows the change straight away, then saves it. A colour picker fires many changes while dragging, so saving waits for a pause. */
  function changeTheme(next: Pick<Branding, "mode" | "accent">, wait = 0) {
    if (!branding) return;
    setBranding({ ...branding, ...next });
    setThemeStatus(null);
    if (saveTimer.current) clearTimeout(saveTimer.current);
    saveTimer.current = setTimeout(async () => {
      try {
        const res = await fetch("/api/branding", {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(next),
        });
        const body = await res.json();
        if (!res.ok) throw new Error(body.error ?? "Couldn't save.");
        saved.current = body;
        setBranding(body);
        setThemeStatus({ ok: true, text: "Saved" });
      } catch (err) {
        if (saved.current) setBranding(saved.current);
        setThemeStatus({ ok: false, text: err instanceof Error && err.message !== "Failed to fetch" ? err.message : "Couldn't reach the server. Try again." });
      }
    }, wait);
  }

  async function sendLogo(init: RequestInit, done: string) {
    setUploading(true);
    setLogoStatus(null);
    try {
      const res = await fetch("/api/branding/logo", init);
      const body = await res.json();
      if (res.ok) {
        saved.current = body;
        setBranding(body);
        setLogoStatus({ ok: true, text: done });
      } else setLogoStatus({ ok: false, text: body.error ?? "Something went wrong." });
    } catch {
      setLogoStatus({ ok: false, text: "Couldn't reach the server. Try again." });
    }
    setUploading(false);
  }

  function upload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = ""; // so choosing the same file again still counts as a change
    if (!file) return;
    if (file.size > MAX_KB * 1024) {
      setLogoStatus({ ok: false, text: `That file is too big. Use an image under ${MAX_KB} KB.` });
      return;
    }
    const form = new FormData();
    form.append("logo", file);
    sendLogo({ method: "POST", body: form }, "Logo updated.");
  }

  const custom = !ACCENTS.some((a) => a.id === branding.accent);
  const customValue = custom ? branding.accent : accentVars(branding.accent)["--brand-light"];

  return (
    <div className="mt-6">
      <h2 className="text-xl font-semibold tracking-tight">Appearance</h2>
      <p className="mt-1 text-sm text-muted">Make your dashboard, and the public status pages you share with clients, look like your company.</p>

      <section className="mt-6 rounded-xl border border-border bg-surface p-5" aria-labelledby="logo-heading">
        <h3 id="logo-heading" className="font-semibold">
          Logo and name
        </h3>
        <p className="mt-0.5 text-sm text-muted">
          Shown at the top of the menu and on your status pages. Without either, the menu shows &ldquo;Run by site-monitors.net&rdquo;.
        </p>
        <div className="mt-4 flex min-h-20 items-center rounded-lg border border-dashed border-border bg-background px-5 py-4">
          <BrandMark branding={branding} />
        </div>
        <div className="mt-4 flex flex-wrap items-center gap-2">
          <input ref={fileInput} type="file" accept="image/png,image/jpeg,image/webp" onChange={upload} className="sr-only" id="logo-file" />
          <button
            type="button"
            onClick={() => fileInput.current?.click()}
            disabled={uploading}
            className="rounded-lg bg-accent px-4 py-2 text-sm font-medium text-accent-foreground hover:opacity-90 disabled:opacity-50"
          >
            {uploading ? "Uploading…" : branding.logoUrl ? "Replace logo" : "Upload logo"}
          </button>
          {branding.logoUrl && (
            <button type="button" onClick={() => sendLogo({ method: "DELETE" }, "Logo removed.")} disabled={uploading} className={BUTTON}>
              Remove logo
            </button>
          )}
        </div>
        <p className="mt-2 text-xs text-muted">PNG, JPEG or WebP, up to {MAX_KB} KB. A square or wide logo on a transparent background works best.</p>
        {logoStatus && (
          <p role={logoStatus.ok ? "status" : "alert"} className={`mt-2 text-sm ${logoStatus.ok ? "text-ok" : "text-bad"}`}>
            {logoStatus.text}
          </p>
        )}

        <form onSubmit={saveName} className="mt-5 border-t border-border pt-5">
          <label htmlFor="brand-name" className="block text-sm font-medium">
            Company or brand name
          </label>
          <p className="text-xs text-muted">Shown next to your logo. Leave it empty to show the logo on its own.</p>
          <div className="mt-2 flex flex-col gap-2 sm:flex-row">
            <input
              id="brand-name"
              value={nameValue}
              onChange={(e) => {
                setNameDraft(e.target.value);
                setNameStatus(null);
              }}
              onKeyDown={(e) => e.key === "Escape" && setNameDraft(null)}
              maxLength={BRAND_NAME_MAX}
              placeholder="Acme Web Studio"
              autoComplete="organization"
              disabled={nameBusy}
              className="min-w-0 flex-1 rounded-lg border border-border bg-background px-3 py-2 text-sm outline-none placeholder:text-muted/70 focus:border-accent focus:ring-2 focus:ring-accent/30 disabled:opacity-60"
            />
            <button type="submit" disabled={nameBusy || !nameChanged} className={BUTTON}>
              {nameBusy ? "Saving…" : "Save name"}
            </button>
          </div>
          {nameStatus && (
            <p role={nameStatus.ok ? "status" : "alert"} className={`mt-2 text-sm ${nameStatus.ok ? "text-ok" : "text-bad"}`}>
              {nameStatus.text}
            </p>
          )}
        </form>
      </section>

      <section className="mt-4 rounded-xl border border-border bg-surface p-5" aria-labelledby="theme-heading">
        <div className="flex items-baseline justify-between gap-3">
          <h3 id="theme-heading" className="font-semibold">
            Theme
          </h3>
          {themeStatus && (
            <p role={themeStatus.ok ? "status" : "alert"} className={`text-sm ${themeStatus.ok ? "text-ok" : "text-bad"}`}>
              {themeStatus.text}
            </p>
          )}
        </div>

        <fieldset className="mt-4">
          <legend className="text-sm font-medium">Light or dark</legend>
          <div className="mt-2 inline-flex flex-wrap gap-1 rounded-lg border border-border p-1">
            {MODES.map((m) => (
              <button
                key={m.id}
                type="button"
                aria-pressed={branding.mode === m.id}
                onClick={() => changeTheme({ mode: m.id, accent: branding.accent })}
                className={`rounded-md px-3 py-1.5 text-sm ${branding.mode === m.id ? "bg-accent text-accent-foreground" : "text-muted hover:text-foreground"}`}
              >
                {m.label}
              </button>
            ))}
          </div>
        </fieldset>

        <fieldset className="mt-5">
          <legend className="text-sm font-medium">Accent colour</legend>
          <p className="text-xs text-muted">Used for buttons, links and highlights.</p>
          <div className="mt-3 flex flex-wrap items-center gap-2.5">
            {ACCENTS.map((a) => (
              <button
                key={a.id}
                type="button"
                title={a.name}
                aria-label={a.name}
                aria-pressed={branding.accent === a.id}
                onClick={() => changeTheme({ mode: branding.mode, accent: a.id })}
                className={`h-9 w-9 rounded-full ring-offset-2 ring-offset-surface ${branding.accent === a.id ? "ring-2 ring-foreground" : "hover:ring-2 hover:ring-border"}`}
                style={{ background: `linear-gradient(135deg, ${a.light} 50%, ${a.dark} 50%)` }}
              />
            ))}
            <label
              className={`flex h-9 cursor-pointer items-center gap-2 rounded-full border border-border pl-1 pr-3 text-sm ring-offset-2 ring-offset-surface ${custom ? "ring-2 ring-foreground" : ""}`}
            >
              <input
                type="color"
                value={customValue}
                onChange={(e) => changeTheme({ mode: branding.mode, accent: e.target.value.toLowerCase() }, 500)}
                className="h-7 w-7 cursor-pointer rounded-full border-0 bg-transparent p-0"
              />
              Custom{custom ? ` ${branding.accent}` : ""}
            </label>
          </div>
          {custom && (
            <p className="mt-2 text-xs text-muted">We adjust a custom colour slightly where needed, so text on it stays readable in light and dark mode.</p>
          )}
        </fieldset>
      </section>
    </div>
  );
}
