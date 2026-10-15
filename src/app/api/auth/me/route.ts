import { currentUser } from "@/lib/auth";

export async function GET(request: Request) {
  const user = currentUser(request);
  return Response.json({ user: user ? { email: user.email } : null });
}
