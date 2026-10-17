import { createHmac, randomBytes, timingSafeEqual } from "node:crypto";
import { appUrl } from "./mail";
import { secret } from "./secret";
import { type ChannelKind, parseWebhookUrl } from "./webhooks";

// Connecting Slack or Discord by signing in to them. The person picks a channel on Slack's or Discord's
// own page, and we get back a webhook for that one channel. Nobody has to make their own app or paste
// an address. We only ask for permission to post into the channel they choose, nothing else.

export type Service = ChannelKind;
export const SERVICES: Service[] = ["slack", "discord"];
export const SERVICE_NAME: Record<Service, string> = { slack: "Slack", discord: "Discord" };

export function isService(value: unknown): value is Service {
  return value === "slack" || value === "discord";
}

interface ClientConfig {
  clientId: string;
  clientSecret: string;
}

/** The app's credentials from Slack or Discord, or null until they're set in the environment. */
export function clientConfig(service: Service): ClientConfig | null {
  const prefix = service === "slack" ? "SLACK" : "DISCORD";
  const clientId = process.env[`${prefix}_CLIENT_ID`]?.trim();
  const clientSecret = process.env[`${prefix}_CLIENT_SECRET`]?.trim();
  return clientId && clientSecret ? { clientId, clientSecret } : null;
}

/** Where Slack or Discord sends the person back to. This exact address is registered in each app's settings. */
export function redirectUri(service: Service): string {
  return `${appUrl()}/api/oauth/${service}/callback`;
}

export function authorizeUrl(service: Service, clientId: string, state: string): string {
  const url =
    service === "slack" ? new URL("https://slack.com/oauth/v2/authorize") : new URL("https://discord.com/oauth2/authorize");
  url.searchParams.set("client_id", clientId);
  url.searchParams.set("redirect_uri", redirectUri(service));
  url.searchParams.set("state", state);
  if (service === "slack") {
    url.searchParams.set("scope", "incoming-webhook");
  } else {
    url.searchParams.set("response_type", "code");
    url.searchParams.set("scope", "webhook.incoming");
  }
  return url.href;
}

// ---------- state: proves the person coming back is the one who started ----------

export const STATE_COOKIE = "sm_oauth";
const STATE_MINUTES = 10;

const sign = (payload: string) => createHmac("sha256", secret()).update(`oauth-state:${payload}`).digest("base64url");

function stateCookie(value: string, maxAgeSeconds: number): string {
  const parts = [`${STATE_COOKIE}=${value}`, "Path=/api/oauth", `Max-Age=${maxAgeSeconds}`, "HttpOnly", "SameSite=Lax"];
  if (process.env.NODE_ENV === "production") parts.push("Secure");
  return parts.join("; ");
}

/**
 * A random value to send as `state`, and a signed cookie tying it to this account and service. Both
 * must come back together, so someone else can't finish a connection into this account (or get this
 * person to connect a channel of theirs).
 */
export function createState(userId: number, service: Service, now = Date.now()): { state: string; cookie: string } {
  const state = randomBytes(24).toString("base64url");
  const payload = [service, userId, now + STATE_MINUTES * 60_000, state].join(".");
  return { state, cookie: stateCookie(`${payload}.${sign(payload)}`, STATE_MINUTES * 60) };
}

export const clearStateCookie = () => stateCookie("", 0);

const same = (a: string, b: string) => {
  const x = Buffer.from(a);
  const y = Buffer.from(b);
  return x.length === y.length && timingSafeEqual(x, y);
};

export function checkState(cookieHeader: string | null, userId: number, service: Service, state: string | null, now = Date.now()): boolean {
  const raw = cookieHeader
    ?.split(";")
    .map((c) => c.trim())
    .find((c) => c.startsWith(`${STATE_COOKIE}=`))
    ?.slice(STATE_COOKIE.length + 1);
  if (!raw || !state) return false;
  const parts = raw.split(".");
  if (parts.length !== 5) return false;
  const [svc, uid, expires, nonce, mac] = parts;
  const payload = [svc, uid, expires, nonce].join(".");
  return same(mac, sign(payload)) && svc === service && uid === String(userId) && Number(expires) > now && same(nonce, state);
}

// ---------- swapping the code for a webhook ----------

export type Exchange = { ok: true; url: string; name: string } | { ok: false; error: string };

/** Display names come from another service, so keep them short and plain. */
const tidy = (text: string) => text.replace(/[\u0000-\u001f\u007f]/g, "").trim().slice(0, 80);

/** `send` is replaceable so tests don't need the network. */
export async function exchangeCode(service: Service, code: string, config: ClientConfig, send: typeof fetch = fetch): Promise<Exchange> {
  const who = SERVICE_NAME[service];
  const form = new URLSearchParams({
    client_id: config.clientId,
    client_secret: config.clientSecret,
    code,
    redirect_uri: redirectUri(service),
  });
  if (service === "discord") form.set("grant_type", "authorization_code");

  let data: Record<string, unknown>;
  try {
    const res = await send(service === "slack" ? "https://slack.com/api/oauth.v2.access" : "https://discord.com/api/oauth2/token", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded", Accept: "application/json" },
      body: form.toString(),
      redirect: "error",
      signal: AbortSignal.timeout(10_000),
    });
    data = (await res.json()) as Record<string, unknown>;
    if (!res.ok && service === "discord") return { ok: false, error: `${who} didn't accept the sign-in. Try connecting again.` };
  } catch {
    return { ok: false, error: `Couldn't reach ${who}. Try again in a moment.` };
  }
  if (service === "slack" && data.ok !== true) return { ok: false, error: `${who} didn't accept the sign-in. Try connecting again.` };

  const hook = (service === "slack" ? data.incoming_webhook : data.webhook) as Record<string, unknown> | undefined;
  const url = typeof hook?.url === "string" ? hook.url : "";
  // Only ever keep an address that is exactly a Slack or Discord webhook, whatever came back.
  const parsed = parseWebhookUrl(service, url);
  if (!parsed) return { ok: false, error: `${who} didn't give us a channel to post to. Try connecting again and pick a channel.` };

  let name: string;
  if (service === "slack") {
    const channel = typeof hook?.channel === "string" ? tidy(hook.channel) : "";
    const team = typeof (data.team as { name?: unknown } | undefined)?.name === "string" ? tidy((data.team as { name: string }).name) : "";
    name = [channel, team].filter(Boolean).join(" in ") || "Slack channel";
  } else {
    const guild = (data.guild as { name?: unknown } | undefined)?.name;
    name = typeof guild === "string" && tidy(guild) ? `A channel in ${tidy(guild)}` : "Discord channel";
  }
  return { ok: true, url: parsed.href, name };
}

/**
 * Tidies up on the provider's side when a channel is disconnected. Discord lets the webhook delete
 * itself. Slack has no way to delete one from outside, so it's left for the person to remove the app
 * in Slack if they want to. Best effort: a failure never stops the disconnect.
 */
export async function removeRemoteWebhook(service: Service, url: string, send: typeof fetch = fetch): Promise<boolean> {
  if (service !== "discord") return false;
  const parsed = parseWebhookUrl("discord", url);
  if (!parsed) return false;
  try {
    const res = await send(parsed.href, { method: "DELETE", redirect: "error", signal: AbortSignal.timeout(8_000) });
    return res.ok || res.status === 404;
  } catch {
    return false;
  }
}
