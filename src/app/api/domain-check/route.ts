import { checkDomain } from "@/lib/domain-check";
import { gatedCheck } from "@/lib/gate";

export async function GET(request: Request) {
  return gatedCheck(request, checkDomain);
}
