import { currentUser } from "@/lib/auth";
import { MAX_CHANNELS, countChannels } from "@/lib/channels";
import { entitlementsFor } from "@/lib/entitlements";
import { appUrl } from "@/lib/mail";
import { authorizeUrl, clientConfig, createState, isService } from "@/lib/oauth";
import { rateLimit } from "@/lib/rate-limit";

const back = (query: string) => new Response(null, { status: 302, headers: { Location: `${appUrl()}/dashboard/integrations?${query}` } });

/** Sends the person to Slack or Discord to pick a channel. Reached from the Connect button. */
export async function GET(request: Request, ctx: RouteContext<"/api/oauth/[service]/start">) {
  const { service } = await ctx.params;
  if (!isService(service)) return new Response("Not found.", { status: 404 });

  const user = currentUser(request);
  if (!user) return new Response(null, { status: 302, headers: { Location: `${appUrl()}/login?next=/dashboard/integrations` } });
  if (!entitlementsFor(user.plan).integrations) return back("error=plan");
  const config = clientConfig(service);
  if (!config) return back(`error=not_set_up&service=${service}`);
  if (countChannels(user.id) >= MAX_CHANNELS) return back("error=limit");
  if (!rateLimit(`oauth-start:${user.id}`, 20, 60 * 60 * 1000)) return back("error=too_many");

  const { state, cookie } = createState(user.id, service);
  return new Response(null, { status: 302, headers: { Location: authorizeUrl(service, config.clientId, state), "Set-Cookie": cookie } });
}
