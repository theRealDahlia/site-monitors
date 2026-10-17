// How an account looks: light or dark, an accent colour, and an optional logo. Used by the server
// (to check what's saved) and the browser (to apply it), so nothing here touches Node or the DOM at
// import time.

export type ThemeMode = "system" | "light" | "dark";
export const THEME_MODES: ThemeMode[] = ["system", "light", "dark"];

/** Ready-made accents, each with a shade that reads well on light and on dark backgrounds. */
export const ACCENTS = [
  { id: "teal", name: "Teal", light: "#0f766e", dark: "#2dd4bf" },
  { id: "blue", name: "Blue", light: "#1d4ed8", dark: "#60a5fa" },
  { id: "indigo", name: "Indigo", light: "#4338ca", dark: "#818cf8" },
  { id: "violet", name: "Violet", light: "#6d28d9", dark: "#a78bfa" },
  { id: "rose", name: "Rose", light: "#be123c", dark: "#fb7185" },
  { id: "orange", name: "Orange", light: "#c2410c", dark: "#fb923c" },
  { id: "green", name: "Green", light: "#15803d", dark: "#4ade80" },
  { id: "slate", name: "Slate", light: "#334155", dark: "#cbd5e1" },
] as const;

export interface Branding {
  mode: ThemeMode;
  /** A ready-made accent's id, or a custom colour as #rrggbb. */
  accent: string;
  logoUrl: string | null;
}

export const DEFAULT_BRANDING: Branding = { mode: "system", accent: "teal", logoUrl: null };

const HEX = /^#[0-9a-f]{6}$/;

export const isThemeMode = (value: unknown): value is ThemeMode => typeof value === "string" && (THEME_MODES as string[]).includes(value);

export function isAccent(value: unknown): value is string {
  return typeof value === "string" && (HEX.test(value) || ACCENTS.some((a) => a.id === value));
}

// ---------- colour maths for custom accents ----------

const rgb = (hex: string) => [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16));
const toHex = (c: number[]) => `#${c.map((v) => Math.round(v).toString(16).padStart(2, "0")).join("")}`;
const mix = (hex: string, toward: number, amount: number) => toHex(rgb(hex).map((v) => v + (toward - v) * amount));

function luminance(hex: string): number {
  const [r, g, b] = rgb(hex).map((v) => {
    const c = v / 255;
    return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
  });
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

const contrast = (a: string, b: string) => {
  const [x, y] = [luminance(a), luminance(b)].sort((p, q) => q - p);
  return (x + 0.05) / (y + 0.05);
};

const LIGHT_BG = "#ffffff";
const DARK_BG = "#0c0a09";

/** Darkens (or lightens) a colour just enough to be readable as text on the given background. */
function readableOn(hex: string, background: string, toward: number): string {
  for (let step = 0; step <= 20; step++) {
    const c = mix(hex, toward, step / 20);
    if (contrast(c, background) >= 4.5) return c;
  }
  return toward === 0 ? "#000000" : "#ffffff";
}

/** Text drawn on top of the accent (buttons): whichever of white or near-black is easier to read. */
const textOn = (hex: string) => (contrast(hex, "#ffffff") >= contrast(hex, DARK_BG) ? "#ffffff" : DARK_BG);

/**
 * The CSS variables for an accent. A custom colour is adjusted, only as much as needed, so that links
 * and buttons stay readable in both light and dark mode, whatever colour was picked.
 */
export function accentVars(accent: string): Record<string, string> {
  const preset = ACCENTS.find((a) => a.id === accent);
  const base = HEX.test(accent) ? accent : ACCENTS[0].light;
  const light = preset ? preset.light : readableOn(base, LIGHT_BG, 0);
  const dark = preset ? preset.dark : readableOn(base, DARK_BG, 255);
  return { "--brand-light": light, "--brand-light-fg": textOn(light), "--brand-dark": dark, "--brand-dark-fg": textOn(dark) };
}

// ---------- applying it in the browser ----------

export const THEME_STORAGE_KEY = "sm_theme";

/** Sets light/dark and the accent on the page. `remember` keeps it for the next visit, to avoid a flash of the default look. */
export function applyTheme(b: Pick<Branding, "mode" | "accent">, remember = false): void {
  const root = document.documentElement;
  if (b.mode === "system") delete root.dataset.theme;
  else root.dataset.theme = b.mode;
  const vars = accentVars(b.accent);
  for (const [k, v] of Object.entries(vars)) root.style.setProperty(k, v);
  if (!remember) return;
  try {
    localStorage.setItem(THEME_STORAGE_KEY, JSON.stringify({ mode: b.mode, vars }));
  } catch {
    // Private browsing or storage turned off: it just won't be remembered.
  }
}

/** Puts the page back to the default look, and forgets the saved one (on log out). */
export function resetTheme(forget = false): void {
  const root = document.documentElement;
  delete root.dataset.theme;
  for (const k of Object.keys(accentVars("teal"))) root.style.removeProperty(k);
  if (!forget) return;
  try {
    localStorage.removeItem(THEME_STORAGE_KEY);
  } catch {
    // nothing to forget
  }
}

/**
 * Runs before the dashboard is drawn, so a returning user sees their own look straight away instead of
 * the default flashing first. It only accepts the values applyTheme saves.
 */
export const THEME_BOOT_SCRIPT = `try{var t=JSON.parse(localStorage.getItem("${THEME_STORAGE_KEY}")||"null");if(t){var r=document.documentElement;if(t.mode==="light"||t.mode==="dark")r.dataset.theme=t.mode;for(var k in t.vars){if(/^--brand-(light|dark)(-fg)?$/.test(k)&&/^#[0-9a-f]{6}$/.test(t.vars[k]))r.style.setProperty(k,t.vars[k])}}}catch(e){}`;
