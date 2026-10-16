import type { Alert, AlertKind } from "./alerts";

export type ChannelKind = "slack" | "discord";

// ---------- address validation ----------

/**
 * A webhook address is only accepted if it is exactly a Slack or Discord webhook address. Anything
 * else is refused, which means this feature can never be used to make our server contact an address
 * of someone's choosing (an internal service, a cloud metadata address, another person's site).
 */
export function parseWebhookUrl(kind: ChannelKind, input: string): URL | null {
  let url: URL;
  try {
    url = new URL(input.trim());
  } catch {
    return null;
  }
  if (url.protocol !== "https:" || url.port || url.username || url.password || url.search || url.hash) return null;

  if (kind === "slack") {
    return url.hostname === "hooks.slack.com" && /^\/services\/[A-Za-z0-9]+\/[A-Za-z0-9]+\/[A-Za-z0-9]+$/.test(url.pathname) ? url : null;
  }
  return (url.hostname === "discord.com" || url.hostname === "discordapp.com") && /^\/api(\/v\d+)?\/webhooks\/\d+\/[A-Za-z0-9_-]+$/.test(url.pathname)
    ? url
    : null;
}

export const WEBHOOK_HELP: Record<ChannelKind, string> = {
  slack: "That doesn't look like a Slack incoming webhook. It should start with https://hooks.slack.com/services/",
  discord: "That doesn't look like a Discord webhook. It should start with https://discord.com/api/webhooks/",
};

/** Shows enough to recognise a webhook without revealing it: the service and the last few characters. */
export function maskWebhook(kind: ChannelKind, url: string): string {
  return `${kind === "slack" ? "hooks.slack.com" : "discord.com"}/…${url.slice(-4)}`;
}

// ---------- message formatting ----------

/** Alerts, plus the things that happen to a site: added, edited, removed. */
export type MessageKind = AlertKind | "test" | "created" | "edited" | "removed";

const COLORS: Record<MessageKind, number> = {
  down: 0xb91c1c,
  ssl_problem: 0xb91c1c,
  ssl_expiry: 0xb45309,
  domain_expiry: 0xb45309,
  recovered: 0x15803d,
  test: 0x0f766e,
  created: 0x0f766e,
  edited: 0x0f766e,
  removed: 0x57534e,
};

const MAX_BODY = 1800;
const clip = (text: string) => (text.length > MAX_BODY ? `${text.slice(0, MAX_BODY - 1)}…` : text);

/** Slack treats &, < and > as markup, including <!channel> and <!here>, so alert text must not carry them through. */
const slackEscape = (text: string) => text.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

export type Message = Pick<Alert, "subject" | "body"> & { kind: MessageKind };

export function formatPayload(kind: ChannelKind, message: Message): unknown {
  const body = clip(message.body);
  if (kind === "slack") {
    return { text: `*${slackEscape(message.subject)}*\n${slackEscape(body)}`, unfurl_links: false, unfurl_media: false };
  }
  return {
    username: "Site Monitors",
    // Nothing in an alert should ever be able to ping @everyone or a role, whatever a remote server's error text says.
    allowed_mentions: { parse: [] },
    embeds: [{ title: message.subject.slice(0, 250), description: body, color: COLORS[message.kind] }],
  };
}

// ---------- delivery ----------

export interface DeliveryResult {
  ok: boolean;
  error: string | null;
}

const NAME = { slack: "Slack", discord: "Discord" } as const;

function explain(kind: ChannelKind, status: number): string {
  const who = NAME[kind];
  if (status === 404 || status === 410) return `${who} says this webhook doesn't exist. Check the URL, or it may have been deleted.`;
  if (status === 401 || status === 403) return `${who} rejected this webhook. It may have been revoked.`;
  if (status === 429) return `${who} is rate limiting this webhook right now.`;
  if (status >= 500) return `${who} had a problem on its side (HTTP ${status}).`;
  return `${who} didn't accept the message (HTTP ${status}).`;
}

/**
 * Posts a message to a webhook. It re-checks the address every time, so even a bad value that got
 * into the database could never be contacted, and it refuses redirects.
 * `send` is replaceable so tests don't need the network.
 */
export async function deliver(kind: ChannelKind, url: string, message: Message, send: typeof fetch = fetch): Promise<DeliveryResult> {
  const parsed = parseWebhookUrl(kind, url);
  if (!parsed) return { ok: false, error: WEBHOOK_HELP[kind] };
  try {
    const res = await send(parsed.href, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(formatPayload(kind, message)),
      redirect: "error",
      signal: AbortSignal.timeout(8_000),
    });
    return res.ok ? { ok: true, error: null } : { ok: false, error: explain(kind, res.status) };
  } catch (err) {
    const timedOut = err instanceof Error && (err.name === "TimeoutError" || err.name === "AbortError");
    return { ok: false, error: timedOut ? `${NAME[kind]} didn't respond in time.` : `Couldn't reach ${NAME[kind]}.` };
  }
}
