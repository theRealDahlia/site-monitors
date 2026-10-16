import { currentUser, sameOrigin } from "@/lib/auth";
import { setUserPlan } from "@/lib/db";
import { ENTITLEMENTS, isPlanId } from "@/lib/entitlements";

/**
 * Lets an admin switch THEIR OWN account between plans, to see what each one looks like. It can
 * only ever change the account making the request, and non-admins are refused outright.
 */
export async function POST(request: Request) {
  if (!sameOrigin(request)) return Response.json({ error: "Request blocked." }, { status: 403 });
  const user = currentUser(request);
  if (!user) return Response.json({ error: "Log in first." }, { status: 401 });
  // Same answer as a page that doesn't exist, so a normal user can't tell this endpoint is here.
  if (!user.isAdmin) return Response.json({ error: "Not found." }, { status: 404 });

  let body: { plan?: unknown };
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: "Invalid request." }, { status: 400 });
  }
  const plan = isPlanId(body.plan) ? body.plan : null;
  if (!plan) return Response.json({ error: "Choose one of the existing plans." }, { status: 400 });

  setUserPlan(user.id, plan);
  console.log(`[admin] ${user.email} switched their plan to ${plan}`);
  return Response.json({ plan, name: ENTITLEMENTS[plan].name });
}
