import { currentUsage } from "@/lib/gate";

export async function GET(request: Request) {
  return Response.json(currentUsage(request));
}
