import { randomBytes } from "node:crypto";
import { db } from "./db";
import { type LogoType } from "./branding";
import type { MonitorRow } from "./monitors-db";
import { newSlug } from "./status-page";
import { type Branding, cleanBrandName, isAccent } from "./theme";

// An agency's clients (Agency plan). A monitor can belong to one client. A client can have its own look (logo, name,
// accent colour), used on its status page and in its reports, and one public status page covering all of its monitors.

export const MAX_CLIENTS = 500;
export const CLIENT_NAME_MAX = 60;

export interface ClientRow {
  id: number;
  user_id: number;
  name: string;
  created_at: number;
  brand_name: string | null;
  accent: string | null;
  logo_id: string | null;
  logo_type: string | null;
  status_public: number;
  status_slug: string | null;
}

const COLUMNS = "id, user_id, name, created_at, brand_name, accent, logo_id, logo_type, status_public, status_slug";
const logoUrl = (id: string | null) => (id ? `/api/logo/${id}` : null);

/** A client's name as it should be saved: tidied, and undefined when it isn't acceptable (empty, too long, or not text). */
export function cleanClientName(value: unknown): string | undefined {
  const name = cleanBrandName(value);
  return name && name.length <= CLIENT_NAME_MAX ? name : undefined;
}

export function listClients(userId: number): (ClientRow & { sites: number })[] {
  return db()
    .prepare(
      `SELECT ${COLUMNS.split(", ").map((c) => `c.${c}`).join(", ")}, (SELECT COUNT(*) FROM monitors m WHERE m.client_id = c.id) AS sites
       FROM clients c WHERE c.user_id = ? ORDER BY c.name COLLATE NOCASE`,
    )
    .all(userId) as unknown as (ClientRow & { sites: number })[];
}

export function getClient(id: number, userId: number): ClientRow | undefined {
  return db().prepare(`SELECT ${COLUMNS} FROM clients WHERE id = ? AND user_id = ?`).get(id, userId) as unknown as ClientRow | undefined;
}

export function findClientByName(userId: number, name: string): ClientRow | undefined {
  return db().prepare(`SELECT ${COLUMNS} FROM clients WHERE user_id = ? AND name = ? COLLATE NOCASE`).get(userId, name) as unknown as ClientRow | undefined;
}

export type Made = { ok: true; client: ClientRow } | { ok: false; error: string; status: number };

export function createClient(userId: number, name: string, now = Date.now()): Made {
  if (findClientByName(userId, name)) return { ok: false, error: `You already have a client called ${name}.`, status: 409 };
  const count = Number((db().prepare("SELECT COUNT(*) AS n FROM clients WHERE user_id = ?").get(userId) as { n: number }).n);
  if (count >= MAX_CLIENTS) return { ok: false, error: `You can have up to ${MAX_CLIENTS} clients.`, status: 403 };
  const id = Number(db().prepare("INSERT INTO clients (user_id, name, created_at) VALUES (?, ?, ?)").run(userId, name, now).lastInsertRowid);
  return { ok: true, client: getClient(id, userId)! };
}

/** The client with this name, made if it isn't there yet. Null if it couldn't be made. */
export function findOrCreateClient(userId: number, name: string): ClientRow | null {
  const found = findClientByName(userId, name);
  if (found) return found;
  const made = createClient(userId, name);
  return made.ok ? made.client : null;
}

export function renameClient(id: number, userId: number, name: string): "ok" | "duplicate" | "missing" {
  const clash = findClientByName(userId, name);
  if (clash && clash.id !== id) return "duplicate";
  return Number(db().prepare("UPDATE clients SET name = ? WHERE id = ? AND user_id = ?").run(name, id, userId).changes) > 0 ? "ok" : "missing";
}

/** Deletes a client. Its monitors stay, without a client; its status page and domain go. */
export function deleteClient(id: number, userId: number): boolean {
  const conn = db();
  if (!getClient(id, userId)) return false;
  conn.prepare("UPDATE monitors SET client_id = NULL WHERE client_id = ? AND user_id = ?").run(id, userId);
  return Number(conn.prepare("DELETE FROM clients WHERE id = ? AND user_id = ?").run(id, userId).changes) > 0;
}

/** Saves the client's own name and accent. Null for either means "use the account's". */
export function setClientLook(id: number, userId: number, look: { brandName: string | null; accent: string | null }): boolean {
  if (look.accent !== null && !isAccent(look.accent)) return false;
  return Number(db().prepare("UPDATE clients SET brand_name = ?, accent = ? WHERE id = ? AND user_id = ?").run(look.brandName, look.accent, id, userId).changes) > 0;
}

/** Stores a new logo under a new random id, so the old address stops working and caches can't show it. */
export function saveClientLogo(id: number, userId: number, bytes: Uint8Array, type: LogoType): string | null {
  const logoId = randomBytes(16).toString("base64url");
  const res = db().prepare("UPDATE clients SET logo = ?, logo_type = ?, logo_id = ? WHERE id = ? AND user_id = ?").run(bytes, type, logoId, id, userId);
  return Number(res.changes) > 0 ? logoUrl(logoId) : null;
}

export function removeClientLogo(id: number, userId: number): void {
  db().prepare("UPDATE clients SET logo = NULL, logo_type = NULL, logo_id = NULL WHERE id = ? AND user_id = ?").run(id, userId);
}

/** Turns the client's public status page on or off. It keeps the same random address when switched off and on again. */
export function setClientStatusPage(id: number, userId: number, enabled: boolean): ClientRow | undefined {
  const row = getClient(id, userId);
  if (!row) return undefined;
  const slug = row.status_slug ?? newSlug();
  try {
    db().prepare("UPDATE clients SET status_public = ?, status_slug = ? WHERE id = ? AND user_id = ?").run(enabled ? 1 : 0, slug, id, userId);
  } catch (err) {
    if ((err as { errcode?: number }).errcode !== 2067) throw err;
    return setClientStatusPage(id, userId, enabled); // the random address was taken; try another
  }
  return getClient(id, userId);
}

/** What the dashboard shows for a client. */
export function clientView(c: ClientRow & { sites?: number }) {
  return {
    id: c.id,
    name: c.name,
    sites: c.sites ?? 0,
    look: { name: c.brand_name, accent: c.accent, logoUrl: logoUrl(c.logo_id) },
    status: { enabled: c.status_public === 1, slug: c.status_slug },
  };
}

/** The look a client's pages and reports have: its own logo, name and accent where set, the account's for the rest. */
export function clientBranding(client: Pick<ClientRow, "brand_name" | "accent" | "logo_id"> | null | undefined, account: Branding): Branding {
  if (!client) return account;
  return {
    ...account,
    name: client.brand_name ?? account.name,
    accent: client.accent && isAccent(client.accent) ? client.accent : account.accent,
    logoUrl: logoUrl(client.logo_id) ?? account.logoUrl,
  };
}

/** The client behind a public status page, only if its owner has turned the page on. The caller checks the plan. */
export function getPublicClient(slug: string): (ClientRow & { owner_plan: string }) | undefined {
  return db()
    .prepare(`SELECT ${COLUMNS.split(", ").map((c) => `c.${c}`).join(", ")}, u.plan AS owner_plan FROM clients c JOIN users u ON u.id = c.user_id WHERE c.status_slug = ? AND c.status_public = 1`)
    .get(slug) as unknown as (ClientRow & { owner_plan: string }) | undefined;
}

export function clientMonitors(clientId: number, userId: number): MonitorRow[] {
  return db().prepare("SELECT * FROM monitors WHERE client_id = ? AND user_id = ? ORDER BY host COLLATE NOCASE").all(clientId, userId) as unknown as MonitorRow[];
}

/** Puts these monitors under a client (or none), if they're the account's own. Returns how many were changed. */
export function assignMonitors(userId: number, monitorIds: number[], clientId: number | null): number {
  if (clientId !== null && !getClient(clientId, userId)) return 0;
  const stmt = db().prepare("UPDATE monitors SET client_id = ? WHERE id = ? AND user_id = ?");
  let changed = 0;
  for (const id of monitorIds) changed += Number(stmt.run(clientId, id, userId).changes);
  return changed;
}
