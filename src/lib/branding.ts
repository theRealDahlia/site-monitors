import { randomBytes } from "node:crypto";
import { db } from "./db";
import { type Branding, DEFAULT_BRANDING, type ThemeMode, isAccent, isThemeMode } from "./theme";

// Each account's look, and the logo it can upload. Every plan has this.

export const MAX_LOGO_BYTES = 300 * 1024;
export const LOGO_ID_PATTERN = /^[A-Za-z0-9_-]{22}$/;

export type LogoType = "image/png" | "image/jpeg" | "image/webp";

interface Row {
  theme_mode: string;
  accent: string;
  logo_id: string | null;
  hide_credit: number;
}

const logoUrl = (id: string | null) => (id ? `/api/logo/${id}` : null);

export function getBranding(userId: number): Branding {
  const row = db().prepare("SELECT theme_mode, accent, logo_id, hide_credit FROM branding WHERE user_id = ?").get(userId) as Row | undefined;
  if (!row) return DEFAULT_BRANDING;
  // Anything unexpected in the database falls back to the default rather than reaching a page.
  return {
    mode: isThemeMode(row.theme_mode) ? row.theme_mode : DEFAULT_BRANDING.mode,
    accent: isAccent(row.accent) ? row.accent : DEFAULT_BRANDING.accent,
    logoUrl: logoUrl(row.logo_id),
    hideCredit: row.hide_credit === 1,
  };
}

/** Saves the "leave our credit off my status pages" setting. Whether the plan allows it is for the caller to decide. */
export function setHideCredit(userId: number, hide: boolean): void {
  db()
    .prepare(
      `INSERT INTO branding (user_id, hide_credit, updated_at) VALUES (?, ?, ?)
       ON CONFLICT(user_id) DO UPDATE SET hide_credit = excluded.hide_credit, updated_at = excluded.updated_at`,
    )
    .run(userId, hide ? 1 : 0, Date.now());
}

export function saveTheme(userId: number, mode: ThemeMode, accent: string): void {
  db()
    .prepare(
      `INSERT INTO branding (user_id, theme_mode, accent, updated_at) VALUES (?, ?, ?, ?)
       ON CONFLICT(user_id) DO UPDATE SET theme_mode = excluded.theme_mode, accent = excluded.accent, updated_at = excluded.updated_at`,
    )
    .run(userId, mode, accent, Date.now());
}

/**
 * What kind of image this really is, judged by its first bytes rather than the name or type the
 * browser claimed. Only PNG, JPEG and WebP are accepted. SVG isn't, because an SVG file can carry
 * scripts.
 */
export function sniffImage(bytes: Uint8Array): LogoType | null {
  const starts = (sig: number[], at = 0) => sig.every((b, i) => bytes[at + i] === b);
  if (starts([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])) return "image/png";
  if (starts([0xff, 0xd8, 0xff])) return "image/jpeg";
  if (starts([0x52, 0x49, 0x46, 0x46]) && starts([0x57, 0x45, 0x42, 0x50], 8)) return "image/webp";
  return null;
}

/** Stores a new logo under a new random id, so the old address stops working and caches can't show it. */
export function saveLogo(userId: number, bytes: Uint8Array, type: LogoType): string {
  const id = randomBytes(16).toString("base64url");
  db()
    .prepare(
      `INSERT INTO branding (user_id, logo, logo_type, logo_id, updated_at) VALUES (?, ?, ?, ?, ?)
       ON CONFLICT(user_id) DO UPDATE SET logo = excluded.logo, logo_type = excluded.logo_type, logo_id = excluded.logo_id, updated_at = excluded.updated_at`,
    )
    .run(userId, bytes, type, id, Date.now());
  return logoUrl(id)!;
}

export function removeLogo(userId: number): void {
  db().prepare("UPDATE branding SET logo = NULL, logo_type = NULL, logo_id = NULL, updated_at = ? WHERE user_id = ?").run(Date.now(), userId);
}

export function getLogo(id: string): { bytes: Uint8Array; type: LogoType } | null {
  if (!LOGO_ID_PATTERN.test(id)) return null;
  const row = db().prepare("SELECT logo, logo_type FROM branding WHERE logo_id = ?").get(id) as { logo: Uint8Array | null; logo_type: string | null } | undefined;
  if (!row?.logo) return null;
  // Checked again on the way out, so only a real image of an allowed kind is ever served.
  const type = sniffImage(row.logo);
  return type ? { bytes: row.logo, type } : null;
}
