import { currentUser, sameOrigin } from "@/lib/auth";
import { assignMonitors, cleanClientName, findOrCreateClient, getClient } from "@/lib/clients";
import { CheckError } from "@/lib/hostname";
import { entitlementsFor } from "@/lib/entitlements";
import { parseMonitorRequest } from "@/lib/monitor-kinds";
import { countMonitors, insertMonitor } from "@/lib/monitors-db";
import { countInWindow, record } from "@/lib/rate-limit";

const HOUR_MS = 60 * 60 * 1000;
const MAX_LINES = 500;
const BATCH = 10;

type Parsed = { line: string; clientName: string | null; host: string; config: Awaited<ReturnType<typeof parseMonitorRequest>>["config"] } | { line: string; error: string };

/**
 * Adds many whole sites from a list: `{ text, clientId? }`. One site per line, as a domain or address, with an optional
 * client name after a comma or tab (a client that doesn't exist yet is made). Sites are checked within a few minutes,
 * and no confirmation email is sent for each.
 */
export async function POST(request: Request) {
  if (!sameOrigin(request)) return Response.json({ error: "Request blocked." }, { status: 403 });
  const user = currentUser(request);
  if (!user) return Response.json({ error: "Log in first." }, { status: 401 });
  const plan = entitlementsFor(user.plan);
  if (!plan.bulkTools) return Response.json({ error: "Importing sites from a list is part of the Agency plan.", code: "plan_required" }, { status: 403 });

  let body: { text?: unknown; clientId?: unknown };
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: "Invalid request." }, { status: 400 });
  }
  if (typeof body?.text !== "string" || body.text.length > 100_000) return Response.json({ error: "Paste a list of sites." }, { status: 400 });
  const defaultClient = body.clientId === null || body.clientId === undefined ? null : Number(body.clientId);
  if (defaultClient !== null && (!Number.isInteger(defaultClient) || !getClient(defaultClient, user.id))) return Response.json({ error: "Client not found." }, { status: 404 });

  const lines = body.text
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter(Boolean);
  // A header row like "domain,client" is skipped.
  if (lines.length && /^(host|hostname|domain|site|url|address)\b/i.test(lines[0])) lines.shift();
  if (lines.length === 0) return Response.json({ error: "Paste a list of sites." }, { status: 400 });
  if (lines.length > MAX_LINES) return Response.json({ error: `Import up to ${MAX_LINES} sites at a time.` }, { status: 400 });

  const rateKey = `monitor-add:${user.id}`;
  if (countInWindow(rateKey, HOUR_MS) + lines.length > plan.addsPerHour) return Response.json({ error: "You're adding monitors too quickly. Try again later." }, { status: 429 });

  const added: { host: string; client: string | null }[] = [];
  const skipped: { line: string; reason: string }[] = [];
  let room = plan.maxMonitors - countMonitors(user.id);
  const seen = new Set<string>();

  for (let i = 0; i < lines.length; i += BATCH) {
    const batch = lines.slice(i, i + BATCH);
    // Looking each site up takes a moment, so a few at a time.
    const parsed = await Promise.all(
      batch.map(async (line): Promise<Parsed> => {
        const [address, clientName] = line.split(/[,\t]/).map((p) => p.trim());
        try {
          return { line, clientName: clientName || null, ...(await parseMonitorRequest("site", { host: address ?? "" })) };
        } catch (err) {
          return { line, error: err instanceof CheckError ? err.message : "Couldn't add that one." };
        }
      }),
    );
    for (const p of parsed) {
      if ("error" in p) {
        skipped.push({ line: p.line, reason: p.error });
        continue;
      }
      if (seen.has(p.host)) {
        skipped.push({ line: p.line, reason: "Listed more than once." });
        continue;
      }
      seen.add(p.host);
      if (room <= 0) {
        skipped.push({ line: p.line, reason: `Over your plan's ${plan.maxMonitors} monitors.` });
        continue;
      }
      const id = insertMonitor(user.id, p.host, Date.now(), p.config);
      if (id === null) {
        skipped.push({ line: p.line, reason: "Already being watched." });
        continue;
      }
      room--;
      record(rateKey, HOUR_MS);
      let clientId = defaultClient;
      let clientLabel: string | null = null;
      if (plan.clients && p.clientName) {
        const name = cleanClientName(p.clientName);
        const client = name ? findOrCreateClient(user.id, name) : null;
        if (client) {
          clientId = client.id;
          clientLabel = client.name;
        }
      }
      if (clientId !== null) {
        assignMonitors(user.id, [id], clientId);
        clientLabel ??= getClient(clientId, user.id)?.name ?? null;
      }
      added.push({ host: p.host, client: clientLabel });
    }
  }
  return Response.json({ added: added.length, skipped }, { status: added.length ? 201 : 200 });
}
