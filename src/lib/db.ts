import { mkdirSync } from "node:fs";
import path from "node:path";
import { DatabaseSync } from "node:sqlite";

// SQLite file on disk. Works on any host with a persistent volume (a VPS, Fly.io, Railway).
// Serverless hosts like Vercel have no persistent disk, so move these queries to Postgres first;
// everything that touches the database lives in this file, monitors-db.ts and auth.ts to keep that swap small.
const DB_PATH = process.env.DATABASE_PATH ?? path.join(process.cwd(), "data", "app.db");

const SCHEMA = `
  CREATE TABLE IF NOT EXISTS users (
    id             INTEGER PRIMARY KEY,
    email          TEXT    NOT NULL UNIQUE,
    password_hash  TEXT    NOT NULL,
    email_verified INTEGER NOT NULL DEFAULT 0,
    created_at     TEXT    NOT NULL
  );

  CREATE TABLE IF NOT EXISTS sessions (
    token_hash TEXT    PRIMARY KEY,
    user_id    INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    created_at TEXT    NOT NULL,
    expires_at INTEGER NOT NULL
  );
  CREATE INDEX IF NOT EXISTS sessions_user ON sessions(user_id);
  CREATE INDEX IF NOT EXISTS sessions_expiry ON sessions(expires_at);

  -- Codes emailed during sign-up. An account is only created once the code for its email is
  -- entered, so nobody can register an address they can't read.
  CREATE TABLE IF NOT EXISTS signup_codes (
    email      TEXT    PRIMARY KEY,
    code_hash  TEXT    NOT NULL,
    attempts   INTEGER NOT NULL DEFAULT 0,
    created_at INTEGER NOT NULL,
    expires_at INTEGER NOT NULL
  );

  -- One row per site a user watches. It holds the latest result of each check plus the
  -- bookkeeping that stops the same alert being emailed twice. Times are epoch milliseconds.
  CREATE TABLE IF NOT EXISTS monitors (
    id         INTEGER PRIMARY KEY,
    user_id    INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    host       TEXT    NOT NULL,
    created_at INTEGER NOT NULL,

    up_status        TEXT    NOT NULL DEFAULT 'pending',
    up_code          INTEGER,
    up_ms            INTEGER,
    up_error         TEXT,
    up_checked_at    INTEGER,
    up_due_at        INTEGER NOT NULL,
    up_failures      INTEGER NOT NULL DEFAULT 0,
    down_since       INTEGER,
    down_alerted     INTEGER NOT NULL DEFAULT 0,

    ssl_status         TEXT    NOT NULL DEFAULT 'pending',
    ssl_expires_at     INTEGER,
    ssl_days           INTEGER,
    ssl_issuer         TEXT,
    ssl_problems       TEXT,
    ssl_error          TEXT,
    ssl_checked_at     INTEGER,
    ssl_due_at         INTEGER NOT NULL,
    ssl_alert_bucket   INTEGER,
    ssl_problem_alerted TEXT,

    dom_status       TEXT    NOT NULL DEFAULT 'pending',
    dom_name         TEXT,
    dom_expires_at   INTEGER,
    dom_days         INTEGER,
    dom_registrar    TEXT,
    dom_note         TEXT,
    dom_checked_at   INTEGER,
    dom_due_at       INTEGER NOT NULL,
    dom_alert_bucket INTEGER,

    last_manual_check_at INTEGER,
    UNIQUE (user_id, host)
  );
  CREATE INDEX IF NOT EXISTS monitors_user ON monitors(user_id);

  -- What the system did and told the user: alerts raised, and whether the email went out.
  CREATE TABLE IF NOT EXISTS monitor_events (
    id         INTEGER PRIMARY KEY,
    monitor_id INTEGER NOT NULL REFERENCES monitors(id) ON DELETE CASCADE,
    user_id    INTEGER NOT NULL,
    kind       TEXT    NOT NULL,
    message    TEXT    NOT NULL,
    details    TEXT,
    emailed    INTEGER NOT NULL DEFAULT 0,
    created_at INTEGER NOT NULL
  );
  CREATE INDEX IF NOT EXISTS monitor_events_user ON monitor_events(user_id, created_at);

  CREATE TABLE IF NOT EXISTS uptime_checks (
    monitor_id INTEGER NOT NULL REFERENCES monitors(id) ON DELETE CASCADE,
    at         INTEGER NOT NULL,
    ok         INTEGER NOT NULL,
    ms         INTEGER
  );
  CREATE INDEX IF NOT EXISTS uptime_checks_monitor ON uptime_checks(monitor_id, at);
`;

/** CREATE TABLE IF NOT EXISTS won't add columns to a table that already exists, so older databases get them here. */
function migrate(conn: DatabaseSync) {
  const columns = (conn.prepare("PRAGMA table_info(monitor_events)").all() as { name: string }[]).map((c) => c.name);
  if (!columns.includes("details")) conn.exec("ALTER TABLE monitor_events ADD COLUMN details TEXT");
}

// Dev mode reloads modules often; keep one connection on globalThis instead of one per reload.
const globalForDb = globalThis as unknown as { __siteMonitorDb?: DatabaseSync };

export function db(): DatabaseSync {
  if (!globalForDb.__siteMonitorDb) {
    mkdirSync(path.dirname(DB_PATH), { recursive: true });
    const conn = new DatabaseSync(DB_PATH);
    conn.exec("PRAGMA journal_mode = WAL; PRAGMA foreign_keys = ON; PRAGMA busy_timeout = 5000;");
    conn.exec(SCHEMA);
    migrate(conn);
    globalForDb.__siteMonitorDb = conn;
  }
  return globalForDb.__siteMonitorDb;
}

export interface UserRow {
  id: number;
  email: string;
  password_hash: string;
  email_verified: number;
  created_at: string;
}

export function findUserByEmail(email: string): UserRow | undefined {
  return db().prepare("SELECT * FROM users WHERE email = ?").get(email) as UserRow | undefined;
}

/** Creates an account for an email that has already been confirmed. Returns its id, or null if taken. */
export function insertUser(email: string, passwordHash: string): number | null {
  try {
    const res = db()
      .prepare("INSERT INTO users (email, password_hash, email_verified, created_at) VALUES (?, ?, 1, ?)")
      .run(email, passwordHash, new Date().toISOString());
    return Number(res.lastInsertRowid);
  } catch (err) {
    if ((err as { errcode?: number }).errcode === 2067) return null; // UNIQUE constraint
    throw err;
  }
}

export function insertSession(tokenHash: string, userId: number, expiresAt: number): void {
  const conn = db();
  conn.prepare("DELETE FROM sessions WHERE expires_at < ?").run(Date.now());
  conn
    .prepare("INSERT INTO sessions (token_hash, user_id, created_at, expires_at) VALUES (?, ?, ?, ?)")
    .run(tokenHash, userId, new Date().toISOString(), expiresAt);
}

export function findSessionUser(tokenHash: string): { id: number; email: string } | undefined {
  return db()
    .prepare(
      `SELECT u.id, u.email FROM sessions s JOIN users u ON u.id = s.user_id
       WHERE s.token_hash = ? AND s.expires_at > ?`,
    )
    .get(tokenHash, Date.now()) as { id: number; email: string } | undefined;
}

export function deleteSession(tokenHash: string): void {
  db().prepare("DELETE FROM sessions WHERE token_hash = ?").run(tokenHash);
}

export interface SignupCodeRow {
  email: string;
  code_hash: string;
  attempts: number;
  created_at: number;
  expires_at: number;
}

export function getSignupCode(email: string): SignupCodeRow | undefined {
  return db().prepare("SELECT * FROM signup_codes WHERE email = ?").get(email) as SignupCodeRow | undefined;
}

/** Stores a fresh code for this email, replacing any earlier one and resetting its attempts. */
export function putSignupCode(email: string, codeHash: string, expiresAt: number): void {
  const conn = db();
  conn.prepare("DELETE FROM signup_codes WHERE expires_at < ?").run(Date.now());
  conn
    .prepare(
      `INSERT INTO signup_codes (email, code_hash, attempts, created_at, expires_at) VALUES (?, ?, 0, ?, ?)
       ON CONFLICT(email) DO UPDATE SET code_hash = excluded.code_hash, attempts = 0,
         created_at = excluded.created_at, expires_at = excluded.expires_at`,
    )
    .run(email, codeHash, Date.now(), expiresAt);
}

/** Counts one guess against the code and returns how many guesses it has now had. */
export function recordCodeAttempt(email: string): number {
  const row = db()
    .prepare("UPDATE signup_codes SET attempts = attempts + 1 WHERE email = ? RETURNING attempts")
    .get(email) as { attempts: number } | undefined;
  return row?.attempts ?? 0;
}

export function deleteSignupCode(email: string): void {
  db().prepare("DELETE FROM signup_codes WHERE email = ?").run(email);
}
