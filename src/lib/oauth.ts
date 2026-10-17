import { createHmac, randomBytes, timingSafeEqual } from "node:crypto";
import { appUrl } from "./mail";
import { secret } from "./secret";
import { SITE_URL } from "./site-url";
import { type ChannelKind, parseSlackBotTarget, parseWebhookUrl } from "./webhooks";

// Connecting Slack or Discord by signing in to them. Nobody has to make their own app or paste an
// address.
// - Slack: the person approves the Site Monitors app for their workspace, and we create an alerts
//   channel there, add them to it, and post into it as the app.
// - Discord: the person adds the Site Monitors bot to their server, and we create an alerts channel
//   there and a webhook inside it. Alerts are posted through that webhook, so the bot's token is only
//   used at connection time, never stored per person.

export type Service = ChannelKind;
export const SERVICES: Service[] = ["slack", "discord"];
export const SERVICE_NAME: Record<Service, string> = { slack: "Slack", discord: "Discord" };

export function isService(value: unknown): value is Service {
  return value === "slack" || value === "discord";
}

interface ClientConfig {
  clientId: string;
  clientSecret: string;
  /** Discord only: the bot's own token, used to create the alerts channel and its webhook. */
  botToken?: string;
}

/** Three dot-separated parts, as Discord bot tokens are. Checked so a bad value can never reach a request header. */
const BOT_TOKEN_SHAPE = /^[A-Za-z0-9_-]{15,}\.[A-Za-z0-9_-]{4,}\.[A-Za-z0-9_-]{20,}$/;

/** The app's credentials from Slack or Discord, or null until they're set in the environment. */
export function clientConfig(service: Service): ClientConfig | null {
  const prefix = service === "slack" ? "SLACK" : "DISCORD";
  const clientId = process.env[`${prefix}_CLIENT_ID`]?.trim();
  const clientSecret = process.env[`${prefix}_CLIENT_SECRET`]?.trim();
  if (!clientId || !clientSecret) return null;
  if (service === "slack") return { clientId, clientSecret };
  // Discord also needs the bot's token. Without a valid one, Discord counts as not set up.
  const botToken = process.env.DISCORD_BOT_TOKEN?.trim();
  return botToken && BOT_TOKEN_SHAPE.test(botToken) ? { clientId, clientSecret, botToken } : null;
}

/** Where Slack or Discord sends the person back to. This exact address is registered in each app's settings. */
export function redirectUri(service: Service): string {
  return `${appUrl()}/api/oauth/${service}/callback`;
}

/**
 * What the Slack app asks for, and nothing more: create a public channel, add the person who
 * connected to it, and post messages. It can't read any messages or see private channels.
 */
export const SLACK_SCOPES = ["channels:manage", "channels:write.invites", "chat:write"];
export const SLACK_CHANNEL_NAME = "site-monitors-alerts";

/**
 * What the Discord bot asks for. `bot` adds it to the server, and `identify` makes the sign-in a full
 * one whose answer says exactly which server was chosen (the address alone only hints at it).
 */
export const DISCORD_SCOPES = ["bot", "identify"];
export const DISCORD_CHANNEL_NAME = "site-monitors-alerts";
/** The bot's permissions: create the channel, create a webhook in it, and see the channel. Nothing else. */
export const DISCORD_PERMISSIONS = (1 << 4) /* Manage Channels */ | (1 << 10) /* View Channel */ | (1 << 29); /* Manage Webhooks */

export function authorizeUrl(service: Service, clientId: string, state: string): string {
  const url =
    service === "slack" ? new URL("https://slack.com/oauth/v2/authorize") : new URL("https://discord.com/oauth2/authorize");
  url.searchParams.set("client_id", clientId);
  url.searchParams.set("redirect_uri", redirectUri(service));
  url.searchParams.set("state", state);
  if (service === "slack") {
    url.searchParams.set("scope", SLACK_SCOPES.join(","));
  } else {
    url.searchParams.set("response_type", "code");
    url.searchParams.set("scope", DISCORD_SCOPES.join(" "));
    url.searchParams.set("permissions", String(DISCORD_PERMISSIONS));
  }
  // Discord wants spaces between scopes written as %20.
  return url.href.replace(/\+/g, "%20");
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

// ---------- swapping the code for a connection ----------

/**
 * A connection ready to save. `secret` is what gets stored (encrypted): a Discord webhook address, or
 * for Slack the app's token and channel. `via` says which, so it's sent the right way.
 */
export type Exchange = { ok: true; secret: string; name: string; via: "oauth" | "bot" } | { ok: false; error: string; code?: "restricted" };

/** Display names come from another service, so keep them short and plain. */
const tidy = (text: string) => text.replace(/[\u0000-\u001f\u007f]/g, "").trim().slice(0, 80);

/** One call to Slack's Web API as the app. Slack answers 200 with `ok: false` for most errors. */
async function slackApi(method: string, token: string, body: Record<string, unknown>, send: typeof fetch): Promise<Record<string, unknown>> {
  const res = await send(`https://slack.com/api/${method}`, {
    method: "POST",
    headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json; charset=utf-8" },
    body: JSON.stringify(body),
    redirect: "error",
    signal: AbortSignal.timeout(10_000),
  });
  return res.ok ? ((await res.json()) as Record<string, unknown>) : { ok: false, error: `http_${res.status}` };
}

/**
 * Creates the alerts channel in the person's workspace and adds them to it. If the name is taken (an
 * existing or archived channel, or another Site Monitors account in the same workspace), a short
 * random ending is added rather than posting into a channel someone else made.
 */
async function createSlackChannel(
  token: string,
  userId: string | null,
  send: typeof fetch,
): Promise<{ id: string; name: string } | { error: string; code?: "restricted" }> {
  for (let attempt = 0; attempt < 4; attempt++) {
    const name = attempt === 0 ? SLACK_CHANNEL_NAME : `${SLACK_CHANNEL_NAME}-${Math.random().toString(36).slice(2, 6)}`;
    const created = await slackApi("conversations.create", token, { name, is_private: false }, send);
    if (created.ok) {
      const channel = created.channel as { id?: unknown; name?: unknown } | undefined;
      const id = typeof channel?.id === "string" ? channel.id : "";
      if (!/^[CG][A-Z0-9]{6,20}$/.test(id)) return { error: "Slack created the channel but didn't say which one. Try connecting again." };
      // Best effort: if this fails the channel still works, and it's public, so they can join it themselves.
      if (userId) await slackApi("conversations.invite", token, { channel: id, users: userId }, send).catch(() => null);
      return { id, name: typeof channel?.name === "string" ? tidy(channel.name) : name };
    }
    if (created.error === "name_taken") continue;
    if (created.error === "restricted_action") {
      return { error: "Your Slack workspace doesn't allow apps to create channels. Ask a workspace admin to allow it, then connect again.", code: "restricted" };
    }
    return { error: "Slack didn't let us create the alerts channel. Try connecting again." };
  }
  return { error: "Couldn't find a free channel name in your Slack workspace. Try connecting again." };
}

// ---------- Discord: create the alerts channel and a webhook in it ----------

const DISCORD_API = "https://discord.com/api/v10";
const SNOWFLAKE = /^\d{15,25}$/;

/** One call to Discord's API as the bot. Discord answers errors with a status and a numeric `code`. */
async function discordApi(
  path: string,
  botToken: string,
  method: "GET" | "POST" | "DELETE",
  body: Record<string, unknown> | undefined,
  send: typeof fetch,
): Promise<{ status: number; data: Record<string, unknown> & { code?: number } }> {
  const res = await send(`${DISCORD_API}${path}`, {
    method,
    headers: {
      Authorization: `Bot ${botToken}`,
      "Content-Type": "application/json",
      // Discord asks every bot to say who it is.
      "User-Agent": `DiscordBot (${SITE_URL}, 1)`,
    },
    body: body ? JSON.stringify(body) : undefined,
    redirect: "error",
    signal: AbortSignal.timeout(10_000),
  });
  const data = (await res.json().catch(() => ({}))) as Record<string, unknown> & { code?: number };
  return { status: res.status, data: data && typeof data === "object" ? data : {} };
}

type DiscordSetup = { webhookUrl: string; channelName: string } | { error: string; code?: "restricted" };

/** Discord's "missing permissions" and "missing access" answers, in plain words. */
function discordFailure(status: number, code: number | undefined, doing: string): { error: string; code?: "restricted" } {
  if (code === 50013 || code === 50001 || status === 403) {
    return {
      error: `Site Monitors isn't allowed to ${doing} in that Discord server. Check the bot kept its permissions (Manage Channels, Manage Webhooks), then connect again.`,
      code: "restricted",
    };
  }
  if (code === 30005 || code === 30007) return { error: `That Discord server has reached a limit on ${code === 30005 ? "channels" : "webhooks"}. Free one up, then connect again.` };
  if (status === 429) return { error: "Discord is busy right now. Try connecting again in a minute." };
  return { error: `Discord didn't let us ${doing}. Try connecting again.` };
}

/**
 * Creates a text channel in the server and a webhook inside it. Discord lets two channels share a name,
 * so an existing name gets a short random ending rather than leaving two identical ones.
 */
async function setUpDiscordChannel(guildId: string, botToken: string, send: typeof fetch): Promise<DiscordSetup> {
  const taken = new Set<string>();
  try {
    const list = await discordApi(`/guilds/${guildId}/channels`, botToken, "GET", undefined, send);
    // Only a list means something here. Anything else (an error object) is ignored.
    for (const c of (Array.isArray(list.data) ? list.data : []) as { name?: unknown }[]) if (typeof c.name === "string") taken.add(c.name);
  } catch {
    // Not essential: the worst case is two channels with the same name.
  }
  let name = DISCORD_CHANNEL_NAME;
  while (taken.has(name)) name = `${DISCORD_CHANNEL_NAME}-${Math.random().toString(36).slice(2, 6)}`;

  const channel = await discordApi(`/guilds/${guildId}/channels`, botToken, "POST", { name, type: 0, topic: "Alerts about your websites, from Site Monitors." }, send);
  const channelId = typeof channel.data.id === "string" ? channel.data.id : "";
  if (channel.status >= 300 || !SNOWFLAKE.test(channelId)) return discordFailure(channel.status, channel.data.code, "create a channel");

  const hook = await discordApi(`/channels/${channelId}/webhooks`, botToken, "POST", { name: "Site Monitors" }, send);
  const hookId = typeof hook.data.id === "string" ? hook.data.id : "";
  const hookToken = typeof hook.data.token === "string" ? hook.data.token : "";
  // Built here rather than taken from the answer, then held to the same strict check as every webhook.
  const parsed = hook.status < 300 && SNOWFLAKE.test(hookId) ? parseWebhookUrl("discord", `https://discord.com/api/webhooks/${hookId}/${hookToken}`) : null;
  if (!parsed) {
    // Don't leave an empty channel behind. Best effort.
    await discordApi(`/channels/${channelId}`, botToken, "DELETE", undefined, send).catch(() => null);
    return discordFailure(hook.status, hook.data.code, "create a webhook");
  }
  return { webhookUrl: parsed.href, channelName: typeof channel.data.name === "string" ? tidy(channel.data.name) : name };
}

/** The sign-in gave us a token for the person's own account. We never needed it, so hand it back. Best effort. */
async function revokeDiscordToken(token: string, config: ClientConfig, send: typeof fetch): Promise<void> {
  const form = new URLSearchParams({ client_id: config.clientId, client_secret: config.clientSecret, token, token_type_hint: "access_token" });
  await send(`${DISCORD_API}/oauth2/token/revoke`, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: form.toString(),
    redirect: "error",
    signal: AbortSignal.timeout(8_000),
  });
}

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

  if (service === "slack") {
    if (data.ok !== true) return { ok: false, error: `${who} didn't accept the sign-in. Try connecting again.` };
    const token = typeof data.access_token === "string" ? data.access_token : "";
    const userId = (data.authed_user as { id?: unknown } | undefined)?.id;
    const team = (data.team as { name?: unknown } | undefined)?.name;
    let channel: Awaited<ReturnType<typeof createSlackChannel>>;
    try {
      channel = token.startsWith("xoxb-")
        ? await createSlackChannel(token, typeof userId === "string" && /^[UW][A-Z0-9]{6,20}$/.test(userId) ? userId : null, send)
        : { error: `${who} didn't give us permission to post. Try connecting again.` };
    } catch {
      return { ok: false, error: `Couldn't reach ${who}. Try again in a moment.` };
    }
    if ("error" in channel) return { ok: false, error: channel.error, code: "code" in channel ? channel.code : undefined };
    const secret = JSON.stringify({ token, channel: channel.id });
    if (!parseSlackBotTarget(secret)) return { ok: false, error: `${who} sent back something unexpected. Try connecting again.` };
    const teamName = typeof team === "string" ? tidy(team) : "";
    return { ok: true, secret, name: `#${channel.name}${teamName ? ` in ${teamName}` : ""}`, via: "bot" };
  }

  // Discord: the answer says which server the bot was added to.
  const guild = data.guild as { id?: unknown; name?: unknown } | undefined;
  const guildId = typeof guild?.id === "string" ? guild.id : "";
  if (!SNOWFLAKE.test(guildId) || !config.botToken) {
    return { ok: false, error: `${who} didn't say which server the bot was added to. Try connecting again and pick a server.` };
  }
  let setup: DiscordSetup;
  try {
    setup = await setUpDiscordChannel(guildId, config.botToken, send);
  } catch {
    return { ok: false, error: `Couldn't reach ${who}. Try again in a moment.` };
  }
  if (typeof data.access_token === "string") await revokeDiscordToken(data.access_token, config, send).catch(() => null);
  if ("error" in setup) return { ok: false, error: setup.error, code: setup.code };
  const guildName = typeof guild?.name === "string" ? tidy(guild.name) : "";
  return { ok: true, secret: setup.webhookUrl, name: `#${setup.channelName}${guildName ? ` in ${guildName}` : ""}`, via: "oauth" };
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
