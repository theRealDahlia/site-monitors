import { currentUser, sameOrigin } from "@/lib/auth";
import { brandingFor, saveTheme, setBrandName, setHideCredit } from "@/lib/branding";
import { entitlementsFor } from "@/lib/entitlements";
import { BRAND_NAME_MAX, cleanBrandName, isAccent, isThemeMode } from "@/lib/theme";

const PLAN_REQUIRED = { error: "Your own logo, name and colours are part of the Starter plan.", code: "plan_required" };

export async function GET(request: Request) {
  const user = currentUser(request);
  if (!user) return Response.json({ error: "Log in first." }, { status: 401 });
  return Response.json(brandingFor(user.id, user.plan));
}

/** Saves light/dark, the accent colour and, if given, the brand name. Starter and up. */
export async function PUT(request: Request) {
  if (!sameOrigin(request)) return Response.json({ error: "Request blocked." }, { status: 403 });
  const user = currentUser(request);
  if (!user) return Response.json({ error: "Log in first." }, { status: 401 });

  if (!entitlementsFor(user.plan).branding) return Response.json(PLAN_REQUIRED, { status: 403 });

  let body: { mode?: unknown; accent?: unknown; hideCredit?: unknown; name?: unknown };
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
  const name = body.name === undefined ? undefined : cleanBrandName(body.name);
  if (body.name !== undefined && name === undefined) {
    return Response.json({ error: `Keep the name to ${BRAND_NAME_MAX} characters or fewer.` }, { status: 400 });
  }
  saveTheme(user.id, body.mode, accent);
  if (typeof body.hideCredit === "boolean") setHideCredit(user.id, body.hideCredit);
  if (name !== undefined) setBrandName(user.id, name);
  return Response.json(brandingFor(user.id, user.plan));
}
