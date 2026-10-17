import { currentUser } from "@/lib/auth";
import { MAX_CHANNELS, addChannel, countChannels, sendToChannel } from "@/lib/channels";
import { entitlementsFor } from "@/lib/entitlements";
import { appUrl } from "@/lib/mail";
import { checkState, clearStateCookie, clientConfig, exchangeCode, isService } from "@/lib/oauth";

/** Where Slack or Discord sends the person back to, with a one-time code we swap for the channel's webhook. */
export async function GET(request: Request, ctx: RouteContext<"/api/oauth/[service]/callback">) {
  const { service } = await ctx.params;
  if (!isService(service)) return new Response("Not found.", { status: 404 });

  // Every way out clears the one-time state cookie and lands back on the Integrations page.
  const back = (query: string) =>
    new Response(null, {
      status: 302,
      headers: { Location: `${appUrl()}/dashboard/integrations?${query}&service=${service}`, "Set-Cookie": clearStateCookie() },
    });

  const user = currentUser(request);
  if (!user) return back("error=logged_out");
  const params = new URL(request.url).searchParams;
  // Checked before anything else, so a link someone else made can't attach a channel to this account.
  if (!checkState(request.headers.get("cookie"), user.id, service, params.get("state"))) return back("error=expired");
  if (params.get("error")) return back("error=denied");
  const code = params.get("code");
  if (!code || code.length > 512) return back("error=failed");

  if (!entitlementsFor(user.plan).integrations) return back("error=plan");
  const config = clientConfig(service);
  if (!config) return back("error=not_set_up");
  if (countChannels(user.id) >= MAX_CHANNELS) return back("error=limit");

  const result = await exchangeCode(service, code, config);
  if (!result.ok) {
    console.error(`[oauth] ${service} connection failed for user ${user.id}: ${result.error}`);
    return back(result.code === "restricted" ? "error=restricted" : "error=failed");
  }

  const id = addChannel(user.id, service, result.name, result.secret, result.via);
  // A first message, so the person sees it working in the channel. If it fails, the channel still
  // shows the error and can be tested again or disconnected.
  await sendToChannel(id, user.id, {
    subject: "Connected to Site Monitors",
    body: "This channel is connected. You'll get alerts about your watched sites here.",
    kind: "test",
  });
  return back("connected=1");
}
