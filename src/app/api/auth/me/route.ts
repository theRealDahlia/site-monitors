import { currentUser, endSession } from "@/lib/auth";
import { getBranding } from "@/lib/branding";
import { SESSION_COOKIE } from "@/lib/cookie-names";
import { ENTITLEMENTS, PLAN_IDS } from "@/lib/entitlements";

export async function GET(request: Request) {
  const user = currentUser(request);

  // A login cookie that no longer matches a real session (it expired, or the account's sessions were
  // cleared). Clear it, so it stops redirecting this browser away from the landing page.
  const staleCookie = !user && (request.headers.get("cookie") ?? "").includes(`${SESSION_COOKIE}=`);

  return Response.json(
    {
      user: user
        ? {
            email: user.email,
            plan: user.plan,
            planName: ENTITLEMENTS[user.plan].name,
            isAdmin: user.isAdmin,
            // The account's look, so the app can show it straight away.
            branding: getBranding(user.id),
            // Only an admin is told the list, for the plan switcher.
            plans: user.isAdmin ? PLAN_IDS.map((id) => ({ id, name: ENTITLEMENTS[id].name })) : undefined,
          }
        : null,
    },
    { headers: staleCookie ? { "Set-Cookie": endSession(request) } : undefined },
  );
}
