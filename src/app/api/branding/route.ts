import { currentUser, sameOrigin } from "@/lib/auth";
import { getBranding, saveTheme, setHideCredit } from "@/lib/branding";
import { entitlementsFor } from "@/lib/entitlements";
import { isAccent, isThemeMode } from "@/lib/theme";

export async function GET(request: Request) {
  const user = currentUser(request);
  if (!user) return Response.json({ error: "Log in first." }, { status: 401 });
  return Response.json(getBranding(user.id));
}

/** Saves light/dark and the accent colour. Every plan can do this. */
export async function PUT(request: Request) {
  if (!sameOrigin(request)) return Response.json({ error: "Request blocked." }, { status: 403 });
  const user = currentUser(request);
  if (!user) return Response.json({ error: "Log in first." }, { status: 401 });

  let body: { mode?: unknown; accent?: unknown; hideCredit?: unknown };
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: "Invalid request." }, { status: 400 });
  }
  const accent = typeof body.accent === "string" ? body.accent.trim().toLowerCase() : null;
  if (!isThemeMode(body.mode) || !isAccent(accent)) return Response.json({ error: "Choose a theme and a colour." }, { status: 400 });
  // Leaving our credit off is a Pro feature. Switching it back on is always allowed, including after a downgrade.
  if (body.hideCredit !== undefined) {
    if (typeof body.hideCredit !== "boolean") return Response.json({ error: "Invalid request." }, { status: 400 });
    if (body.hideCredit && !entitlementsFor(user.plan).whiteLabel) {
      return Response.json({ error: "Removing the Site Monitors credit is part of the Pro plan.", code: "plan_required" }, { status: 403 });
    }
  }
  saveTheme(user.id, body.mode, accent);
  if (typeof body.hideCredit === "boolean") setHideCredit(user.id, body.hideCredit);
  return Response.json(getBranding(user.id));
}
