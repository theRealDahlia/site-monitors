"use client";

import { useEffect, useRef, useState } from "react";
import { BrandMark, useBranding } from "@/components/branding-context";
import { ACCENTS, type Branding, type ThemeMode, accentVars } from "@/lib/theme";

const MODES: { id: ThemeMode; label: string }[] = [
  { id: "system", label: "Match device" },
  { id: "light", label: "Light" },
  { id: "dark", label: "Dark" },
];
const MAX_KB = 300;
const BUTTON = "rounded-lg border border-border px-4 py-2 text-sm hover:border-accent hover:text-accent disabled:opacity-50";

type Status = { ok: boolean; text: string } | null;

/** The Appearance page: the account's own logo, light or dark, and accent colour. Every plan has it. */
export default function Appearance() {
  const { branding, setBranding } = useBranding();
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
    <div>
      <h1 className="text-3xl font-semibold tracking-tight">Appearance</h1>
      <p className="mt-2 text-muted">Make your dashboard, and the public status pages you share with clients, look like your company.</p>

      <section className="mt-6 rounded-xl border border-border bg-surface p-5" aria-labelledby="logo-heading">
        <h2 id="logo-heading" className="font-semibold">
          Logo
        </h2>
        <p className="mt-0.5 text-sm text-muted">
          Shown at the top of the menu and on your status pages. Without one, the menu shows &ldquo;Run by site-monitors.net&rdquo;.
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
        <p className="mt-2 text-xs text-muted">PNG, JPEG or WebP, up to {MAX_KB} KB. A wide logo on a transparent background works best.</p>
        {logoStatus && (
          <p role={logoStatus.ok ? "status" : "alert"} className={`mt-2 text-sm ${logoStatus.ok ? "text-ok" : "text-bad"}`}>
            {logoStatus.text}
          </p>
        )}
      </section>

      <section className="mt-4 rounded-xl border border-border bg-surface p-5" aria-labelledby="theme-heading">
        <div className="flex items-baseline justify-between gap-3">
          <h2 id="theme-heading" className="font-semibold">
            Theme
          </h2>
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
