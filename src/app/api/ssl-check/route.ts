import { gatedCheck } from "@/lib/gate";
import { checkSsl } from "@/lib/ssl-check";

export async function GET(request: Request) {
  return gatedCheck(request, checkSsl);
}
