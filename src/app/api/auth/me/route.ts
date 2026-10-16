import { currentUser } from "@/lib/auth";
import { ENTITLEMENTS, PLAN_IDS } from "@/lib/entitlements";

export async function GET(request: Request) {
  const user = currentUser(request);
  return Response.json({ user: user
      ? {
          email: user.email,
          plan: user.plan,
          isAdmin: user.isAdmin,
          // Only an admin is told the list, for the plan switcher.
          plans: user.isAdmin ? PLAN_IDS.map((id) => ({ id, name: ENTITLEMENTS[id].name })) : undefined,
        }
      : null });
}
