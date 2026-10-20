import { createHash, randomBytes } from "node:crypto";
import { db } from "./db";
import { entitlementsFor } from "./entitlements";
import { rateLimit } from "./rate-limit";

// Keys for the read-only API (Pro). A key is shown once, when it's made; we keep only a hash of it, so a copy of the
// database can't be used to read anyone's data. A key belongs to the account, whoever on the team made it.

export const MAX_KEYS = 5;
const NAME_MAX = 60;
const sha256 = (v: string) => createHash("sha256").update(v).digest("hex");

export interface KeyView {
  id: number;
  name: string;
  /** The start of the key, to tell keys apart. */
  prefix: string;
  createdAt: number;
  lastUsedAt: number | null;
}

export function listKeys(userId: number): KeyView[] {
  return (
    db().prepare("SELECT id, name, prefix, created_at, last_used_at FROM api_keys WHERE user_id = ? ORDER BY created_at, id").all(userId) as {
      id: number;
      name: string;
      prefix: string;
      created_at: number;
      last_used_at: number | null;
    }[]
  ).map((r) => ({ id: r.id, name: r.name, prefix: r.prefix, createdAt: r.created_at, lastUsedAt: r.last_used_at }));
}

/** Makes a key. The returned `key` is the only time it's ever available. */
export function createKey(userId: number, nameInput: unknown, now = Date.now()): { ok: true; key: string; view: KeyView } | { ok: false; error: string } {
  const name = typeof nameInput === "string" ? nameInput.replace(/[\p{Cc}\p{Cf}]/gu, "").trim().slice(0, NAME_MAX) : "";
  if (listKeys(userId).length >= MAX_KEYS) return { ok: false, error: `You can have up to ${MAX_KEYS} keys. Delete one to make another.` };
  const key = `sm_${randomBytes(24).toString("base64url")}`;
  const prefix = key.slice(0, 10);
  const id = Number(db().prepare("INSERT INTO api_keys (user_id, name, key_hash, prefix, created_at) VALUES (?, ?, ?, ?, ?)").run(userId, name || "API key", sha256(key), prefix, now).lastInsertRowid);
  return { ok: true, key, view: listKeys(userId).find((k) => k.id === id)! };
}

export function deleteKey(userId: number, id: number): boolean {
  return Number(db().prepare("DELETE FROM api_keys WHERE id = ? AND user_id = ?").run(id, userId).changes) > 0;
}

export type ApiCaller = { ok: true; userId: number; plan: string } | { ok: false; response: Response };

const deny = (status: number, error: string) => ({ ok: false as const, response: Response.json({ error }, { status, headers: { "WWW-Authenticate": 'Bearer realm="api"' } }) });

/** The account behind an API request's `Authorization: Bearer <key>`, if the key is real and the plan includes the API. */
export function apiCaller(request: Request, now = Date.now()): ApiCaller {
  const header = request.headers.get("authorization") ?? "";
  const key = /^Bearer\s+(sm_[A-Za-z0-9_-]{32})$/.exec(header)?.[1];
  if (!key) return deny(401, "Send your API key as: Authorization: Bearer sm_...");
  const row = db()
    .prepare("SELECT k.id, k.user_id, u.plan FROM api_keys k JOIN users u ON u.id = k.user_id WHERE k.key_hash = ?")
    .get(sha256(key)) as { id: number; user_id: number; plan: string } | undefined;
  if (!row) return deny(401, "That API key isn't valid.");
  if (!entitlementsFor(row.plan).apiAccess) return deny(403, "The API is part of the Pro plan.");
  if (!rateLimit(`api:${row.id}`, 120, 60_000)) return { ok: false, response: Response.json({ error: "Too many requests: the limit is 120 a minute." }, { status: 429, headers: { "Retry-After": "60" } }) };
  db().prepare("UPDATE api_keys SET last_used_at = ? WHERE id = ?").run(now, row.id);
  return { ok: true, userId: row.user_id, plan: row.plan };
}
