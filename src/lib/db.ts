import { mkdirSync } from "node:fs";
import path from "node:path";
import { DatabaseSync } from "node:sqlite";

// SQLite file on disk. Works on any host with a persistent volume (a VPS, Fly.io, Railway).
// Serverless hosts like Vercel have no persistent disk, so move these queries to Postgres first;
// everything that touches the database lives in this file, monitors-db.ts and auth.ts to keep that swap small.
const DB_PATH = process.env.DATABASE_PATH ?? path.join(process.cwd(), "data", "app.db");

/**
 * Notifications. They deliberately do NOT depend on the monitor still existing: each keeps its own
 * copy of the site's name, so a "site removed" notification survives the removal it describes.
 * They belong to the user, and go when the user's account does.
 */
const eventsTable = (name: string) => `CREATE TABLE IF NOT EXISTS ${name} (
    id         INTEGER PRIMARY KEY,
    user_id    INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    monitor_id INTEGER,
    host       TEXT    NOT NULL,
    kind       TEXT    NOT NULL,
    message    TEXT    NOT NULL,
    details    TEXT,
    emailed    INTEGER NOT NULL DEFAULT 0,
    created_at INTEGER NOT NULL
  );`;

const SCHEMA = `
  CREATE TABLE IF NOT EXISTS users (
    id             INTEGER PRIMARY KEY,
    email          TEXT    NOT NULL UNIQUE,
    password_hash  TEXT    NOT NULL,
    email_verified INTEGER NOT NULL DEFAULT 0,
    plan           TEXT    NOT NULL DEFAULT 'free',
    -- The development-only admin flag. No code in this project sets it, and the database allows at most one.
    is_admin       INTEGER NOT NULL DEFAULT 0,
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

    -- AI visibility (Pro): the latest result as JSON, plus what we've already alerted about.
    ai_status      TEXT    NOT NULL DEFAULT 'pending',
    ai_result      TEXT,
    ai_checked_at  INTEGER,
    ai_due_at      INTEGER NOT NULL DEFAULT 0,
    ai_alerted_sig TEXT,
    ai_pending_sig TEXT,

    last_manual_check_at INTEGER,

    -- Public status page. The slug is random so the address can't be guessed, and it stays the
    -- same if the page is switched off and on again.
    status_public INTEGER NOT NULL DEFAULT 0,
    status_slug   TEXT,

    -- What kind of monitor this is (see monitor-kinds.ts). 'site' watches a whole site: uptime, SSL, domain and AI.
    -- The others watch one thing: 'http' a single address (with an optional keyword rule), 'tcp' a port, and
    -- 'heartbeat' waits for a cron job to check in. For those, host is the label shown everywhere (the address
    -- without https://, host:port, or the name the owner gave it).
    kind          TEXT    NOT NULL DEFAULT 'site',
    url           TEXT,
    port          INTEGER,
    keyword       TEXT,
    keyword_mode  TEXT,
    hb_token      TEXT,
    hb_every_ms   INTEGER,
    hb_grace_ms   INTEGER,
    hb_last_ping  INTEGER,

    -- Who gets this monitor's alerts: a JSON list of destinations (see alert-targets.ts), or NULL for everyone.
    alert_targets   TEXT,
    -- The current outage's acknowledgement and escalation (see escalation.ts). Cleared when it's back up.
    down_alerted_at INTEGER,
    ack_at          INTEGER,
    escalated_at    INTEGER,

    -- The daily health scan of a whole site (see health-scan.ts): the latest result as JSON, the DNS records last
    -- seen (to notice changes), and the broken links we last alerted about.
    scan_result     TEXT,
    scan_checked_at INTEGER,
    scan_due_at     INTEGER NOT NULL DEFAULT 0,
    dns_baseline    TEXT,
    links_alerted   TEXT,
    security_alerted TEXT,

    UNIQUE (user_id, host)
  );
  CREATE INDEX IF NOT EXISTS monitors_user ON monitors(user_id);

  -- What the system did and told the user: alerts raised, and whether the email went out.
  ${eventsTable("monitor_events")}
  CREATE INDEX IF NOT EXISTS monitor_events_user ON monitor_events(user_id, created_at);

  -- Raw one-minute checks are only kept for a couple of days; older ones are rolled up into hourly totals.
  CREATE TABLE IF NOT EXISTS uptime_hourly (
    monitor_id INTEGER NOT NULL REFERENCES monitors(id) ON DELETE CASCADE,
    hour       INTEGER NOT NULL,
    total      INTEGER NOT NULL,
    ok         INTEGER NOT NULL,
    -- Response times in the hour, summed, and how many there were, for averages in reports.
    ms_sum     INTEGER NOT NULL DEFAULT 0,
    ms_n       INTEGER NOT NULL DEFAULT 0,
    PRIMARY KEY (monitor_id, hour)
  );

  -- Periods when a site was confirmed down, shown on its status page.
  CREATE TABLE IF NOT EXISTS monitor_incidents (
    id         INTEGER PRIMARY KEY,
    monitor_id INTEGER NOT NULL REFERENCES monitors(id) ON DELETE CASCADE,
    started_at INTEGER NOT NULL,
    ended_at   INTEGER,
    error      TEXT
  );
  CREATE INDEX IF NOT EXISTS monitor_incidents_monitor ON monitor_incidents(monitor_id, started_at);

  -- Links for choosing a new password. Only a hash of each link's token is kept, so a copy of the
  -- database can't be used to take over an account. At most one is active per account.
  CREATE TABLE IF NOT EXISTS password_resets (
    user_id    INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    token_hash TEXT    NOT NULL UNIQUE,
    created_at INTEGER NOT NULL,
    expires_at INTEGER NOT NULL
  );
  CREATE INDEX IF NOT EXISTS password_resets_user ON password_resets(user_id);

  -- Slack and Discord webhooks. The URL is a secret, so it is stored encrypted.
  CREATE TABLE IF NOT EXISTS notification_channels (
    id              INTEGER PRIMARY KEY,
    user_id         INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    kind            TEXT    NOT NULL,
    name            TEXT    NOT NULL,
    url_enc         TEXT    NOT NULL,
    created_at      INTEGER NOT NULL,
    last_attempt_at INTEGER,
    last_ok_at      INTEGER,
    last_error      TEXT,
    -- Off means it's kept but gets no messages.
    enabled         INTEGER NOT NULL DEFAULT 1,
    -- 'oauth' when connected by signing in to Slack or Discord, 'manual' for an older pasted webhook.
    via             TEXT    NOT NULL DEFAULT 'manual'
  );
  CREATE INDEX IF NOT EXISTS notification_channels_user ON notification_channels(user_id);

  -- More addresses for alert emails, besides the account's own. One only receives anything after its
  -- owner has confirmed it from that inbox, so this can't be used to send email to strangers.
  CREATE TABLE IF NOT EXISTS alert_emails (
    id              INTEGER PRIMARY KEY,
    user_id         INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    email           TEXT    NOT NULL,
    enabled         INTEGER NOT NULL DEFAULT 1,
    confirmed_at    INTEGER,
    -- sha256 of the one-time confirmation link's token; cleared once it's used.
    confirm_hash    TEXT,
    confirm_expires INTEGER,
    confirm_sent_at INTEGER,
    created_at      INTEGER NOT NULL,
    UNIQUE (user_id, email)
  );
  CREATE UNIQUE INDEX IF NOT EXISTS alert_emails_confirm ON alert_emails(confirm_hash) WHERE confirm_hash IS NOT NULL;

  -- Each account's look: light or dark, accent colour, and an optional logo of their own.
  CREATE TABLE IF NOT EXISTS branding (
    user_id    INTEGER PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
    theme_mode TEXT    NOT NULL DEFAULT 'system',
    accent     TEXT    NOT NULL DEFAULT 'teal',
    logo       BLOB,
    logo_type  TEXT,
    -- Random, and changed on every upload, so the logo's address can be cached forever and reveals nothing.
    logo_id    TEXT UNIQUE,
    -- White label (Pro): leave "Run by site-monitors.net" off the account's status pages.
    hide_credit INTEGER NOT NULL DEFAULT 0,
    -- The company or brand name shown next to the logo.
    brand_name TEXT,
    updated_at INTEGER NOT NULL
  );

  -- A status page on the owner's own domain (Pro). Someone only owns a domain once they've shown they control its
  -- DNS (verified_at). Until then it's just a claim, and several accounts can claim the same name; the first to
  -- prove it wins, and only one account can ever hold a verified domain.
  CREATE TABLE IF NOT EXISTS custom_domains (
    id          INTEGER PRIMARY KEY,
    user_id     INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    -- The page the domain shows: one site's status page, or (Agency) one client's. Exactly one of the two is set.
    monitor_id  INTEGER UNIQUE REFERENCES monitors(id) ON DELETE CASCADE,
    client_id   INTEGER UNIQUE REFERENCES clients(id) ON DELETE CASCADE,
    domain      TEXT    NOT NULL,
    -- Goes in a DNS TXT record to prove control. Not a password: anyone who can read the owner's DNS can read it.
    token       TEXT    NOT NULL,
    verified_at INTEGER,
    last_check_at INTEGER,
    -- How many daily re-checks in a row have failed to find the TXT record.
    fail_count  INTEGER NOT NULL DEFAULT 0,
    created_at  INTEGER NOT NULL
  );
  CREATE UNIQUE INDEX IF NOT EXISTS custom_domains_verified ON custom_domains(domain) WHERE verified_at IS NOT NULL;
  CREATE INDEX IF NOT EXISTS custom_domains_domain ON custom_domains(domain);

  -- What the owner tells visitors on a status page: incidents, with a timeline of updates, and scheduled maintenance.
  -- These are written by people; the automatic outage record is monitor_incidents.
  CREATE TABLE IF NOT EXISTS status_notices (
    id             INTEGER PRIMARY KEY,
    user_id        INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    monitor_id     INTEGER NOT NULL REFERENCES monitors(id) ON DELETE CASCADE,
    -- 'incident' or 'maintenance'
    kind           TEXT    NOT NULL,
    title          TEXT    NOT NULL,
    -- incident: 'minor' or 'major'
    impact         TEXT,
    -- incident: investigating, identified, monitoring or resolved. maintenance: scheduled or cancelled (whether it's
    -- under way or over comes from its times).
    state          TEXT    NOT NULL,
    starts_at      INTEGER,
    ends_at        INTEGER,
    -- maintenance: no down alerts while it's under way
    silence_alerts INTEGER NOT NULL DEFAULT 1,
    created_at     INTEGER NOT NULL,
    resolved_at    INTEGER
  );
  CREATE INDEX IF NOT EXISTS status_notices_monitor ON status_notices(monitor_id, created_at);

  CREATE TABLE IF NOT EXISTS status_notice_updates (
    id         INTEGER PRIMARY KEY,
    notice_id  INTEGER NOT NULL REFERENCES status_notices(id) ON DELETE CASCADE,
    state      TEXT    NOT NULL,
    message    TEXT    NOT NULL,
    created_at INTEGER NOT NULL
  );
  CREATE INDEX IF NOT EXISTS status_notice_updates_notice ON status_notice_updates(notice_id, created_at);

  -- Visitors who asked to be emailed when a status page changes (Pro). Nobody gets anything until they've clicked the
  -- confirmation link sent to their address, and every email has a link to stop them.
  CREATE TABLE IF NOT EXISTS status_subscribers (
    id              INTEGER PRIMARY KEY,
    monitor_id      INTEGER NOT NULL REFERENCES monitors(id) ON DELETE CASCADE,
    email           TEXT    NOT NULL,
    confirmed_at    INTEGER,
    -- sha256 of the one-time confirmation link's token; cleared once it's used.
    confirm_hash    TEXT,
    confirm_expires INTEGER,
    confirm_sent_at INTEGER,
    created_at      INTEGER NOT NULL,
    UNIQUE (monitor_id, email)
  );
  CREATE UNIQUE INDEX IF NOT EXISTS status_subscribers_confirm ON status_subscribers(confirm_hash) WHERE confirm_hash IS NOT NULL;

  -- If an outage alert isn't acknowledged in time, who else to tell (Pro). One rule per account.
  CREATE TABLE IF NOT EXISTS escalation_policies (
    user_id    INTEGER PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
    enabled    INTEGER NOT NULL DEFAULT 0,
    after_ms   INTEGER NOT NULL,
    -- JSON list of destinations, as in monitors.alert_targets
    targets    TEXT    NOT NULL,
    updated_at INTEGER NOT NULL
  );

  -- Text and call alerts were removed.
  DROP TABLE IF EXISTS phone_usage;
  DROP TABLE IF EXISTS phones;

  -- An agency's clients (Agency). A monitor can belong to one; a client can have its own status page, look and reports.
  CREATE TABLE IF NOT EXISTS clients (
    id            INTEGER PRIMARY KEY,
    user_id       INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    name          TEXT    NOT NULL,
    created_at    INTEGER NOT NULL,
    -- The client's own look on its status page and reports. Empty means the account's.
    brand_name    TEXT,
    accent        TEXT,
    logo          BLOB,
    logo_type     TEXT,
    logo_id       TEXT UNIQUE,
    -- One public status page covering all of the client's monitors, at a random address like a site's.
    status_public INTEGER NOT NULL DEFAULT 0,
    status_slug   TEXT,
    UNIQUE (user_id, name COLLATE NOCASE)
  );
  CREATE UNIQUE INDEX IF NOT EXISTS clients_slug ON clients(status_slug) WHERE status_slug IS NOT NULL;

  -- Monthly reports for clients (Pro): which monitors, the uptime target, and who gets it.
  CREATE TABLE IF NOT EXISTS reports (
    id              INTEGER PRIMARY KEY,
    user_id         INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    name            TEXT    NOT NULL,
    -- JSON list of monitor ids
    monitor_ids     TEXT    NOT NULL,
    sla_target      REAL    NOT NULL DEFAULT 99.9,
    enabled         INTEGER NOT NULL DEFAULT 1,
    -- 'YYYY-MM' of the last month whose report went out
    last_sent_month TEXT,
    created_at      INTEGER NOT NULL
  );
  CREATE INDEX IF NOT EXISTS reports_user ON reports(user_id);

  -- Who gets a report. Like every address we email for someone else, it gets nothing until it has confirmed.
  CREATE TABLE IF NOT EXISTS report_recipients (
    id              INTEGER PRIMARY KEY,
    report_id       INTEGER NOT NULL REFERENCES reports(id) ON DELETE CASCADE,
    email           TEXT    NOT NULL,
    confirmed_at    INTEGER,
    confirm_hash    TEXT,
    confirm_expires INTEGER,
    created_at      INTEGER NOT NULL,
    UNIQUE (report_id, email)
  );
  CREATE UNIQUE INDEX IF NOT EXISTS report_recipients_confirm ON report_recipients(confirm_hash) WHERE confirm_hash IS NOT NULL;

  -- Teams (Pro): people who sign in with their own login and work in someone else's account. Someone is in at most
  -- one team, and only joins by accepting an invitation sent to their own address.
  CREATE TABLE IF NOT EXISTS team_members (
    user_id    INTEGER PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
    owner_id   INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    created_at INTEGER NOT NULL
  );
  CREATE INDEX IF NOT EXISTS team_members_owner ON team_members(owner_id);

  CREATE TABLE IF NOT EXISTS team_invites (
    id         INTEGER PRIMARY KEY,
    owner_id   INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    email      TEXT    NOT NULL,
    token_hash TEXT    NOT NULL UNIQUE,
    expires_at INTEGER NOT NULL,
    created_at INTEGER NOT NULL,
    UNIQUE (owner_id, email)
  );

  -- Uptime per monitor per UTC day, kept for over a year so plans with long history can show it. Filled from the raw
  -- checks at the same time as the hourly totals.
  CREATE TABLE IF NOT EXISTS uptime_daily (
    monitor_id INTEGER NOT NULL REFERENCES monitors(id) ON DELETE CASCADE,
    day        INTEGER NOT NULL,
    total      INTEGER NOT NULL,
    ok         INTEGER NOT NULL,
    ms_sum     INTEGER NOT NULL DEFAULT 0,
    ms_n       INTEGER NOT NULL DEFAULT 0,
    PRIMARY KEY (monitor_id, day)
  );

  -- Keys for the read-only API (Pro). Only a hash is kept: the key itself is shown once, when it's made.
  CREATE TABLE IF NOT EXISTS api_keys (
    id           INTEGER PRIMARY KEY,
    user_id      INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    name         TEXT    NOT NULL,
    key_hash     TEXT    NOT NULL UNIQUE,
    prefix       TEXT    NOT NULL,
    created_at   INTEGER NOT NULL,
    last_used_at INTEGER
  );

  CREATE TABLE IF NOT EXISTS uptime_checks (
    monitor_id INTEGER NOT NULL REFERENCES monitors(id) ON DELETE CASCADE,
    at         INTEGER NOT NULL,
    ok         INTEGER NOT NULL,
    ms         INTEGER
  );
  CREATE INDEX IF NOT EXISTS uptime_checks_monitor ON uptime_checks(monitor_id, at);
`;

/** CREATE TABLE IF NOT EXISTS won't change a table that already exists, so older databases are brought up to date here. */
function migrate(conn: DatabaseSync) {
  const columns = () => (conn.prepare("PRAGMA table_info(monitor_events)").all() as { name: string }[]).map((c) => c.name);

  if (!columns().includes("details")) conn.exec("ALTER TABLE monitor_events ADD COLUMN details TEXT");

  const has = (table: string, column: string) =>
    (conn.prepare(`PRAGMA table_info(${table})`).all() as { name: string }[]).some((c) => c.name === column);
  if (!has("users", "plan")) conn.exec("ALTER TABLE users ADD COLUMN plan TEXT NOT NULL DEFAULT 'free'");
  if (!has("users", "is_admin")) conn.exec("ALTER TABLE users ADD COLUMN is_admin INTEGER NOT NULL DEFAULT 0");
  // Billing (see billing.ts). The Stripe customer is made on the first checkout; the subscription is whatever Stripe last told us about.
  if (!has("users", "stripe_customer_id")) conn.exec("ALTER TABLE users ADD COLUMN stripe_customer_id TEXT");
  if (!has("users", "stripe_subscription_id")) conn.exec("ALTER TABLE users ADD COLUMN stripe_subscription_id TEXT");
  if (!has("monitors", "status_public")) conn.exec("ALTER TABLE monitors ADD COLUMN status_public INTEGER NOT NULL DEFAULT 0");
  if (!has("branding", "hide_credit")) conn.exec("ALTER TABLE branding ADD COLUMN hide_credit INTEGER NOT NULL DEFAULT 0");
  if (!has("branding", "brand_name")) conn.exec("ALTER TABLE branding ADD COLUMN brand_name TEXT");
  if (!has("monitors", "status_slug")) conn.exec("ALTER TABLE monitors ADD COLUMN status_slug TEXT");
  if (!has("monitors", "ai_status")) conn.exec("ALTER TABLE monitors ADD COLUMN ai_status TEXT NOT NULL DEFAULT 'pending'");
  if (!has("monitors", "ai_result")) conn.exec("ALTER TABLE monitors ADD COLUMN ai_result TEXT");
  if (!has("monitors", "ai_checked_at")) conn.exec("ALTER TABLE monitors ADD COLUMN ai_checked_at INTEGER");
  // Existing sites are due straight away, so an account that has just moved up to Pro gets its first AI check at once.
  if (!has("monitors", "ai_due_at")) conn.exec("ALTER TABLE monitors ADD COLUMN ai_due_at INTEGER NOT NULL DEFAULT 0");
  if (!has("monitors", "ai_alerted_sig")) conn.exec("ALTER TABLE monitors ADD COLUMN ai_alerted_sig TEXT");
  if (!has("monitors", "ai_pending_sig")) conn.exec("ALTER TABLE monitors ADD COLUMN ai_pending_sig TEXT");
  // Whether alerts go to the account's own address. Off is allowed, as long as the person chooses it.
  if (!has("users", "alerts_to_account")) conn.exec("ALTER TABLE users ADD COLUMN alerts_to_account INTEGER NOT NULL DEFAULT 1");
  if (!has("notification_channels", "enabled")) conn.exec("ALTER TABLE notification_channels ADD COLUMN enabled INTEGER NOT NULL DEFAULT 1");
  if (!has("notification_channels", "via")) conn.exec("ALTER TABLE notification_channels ADD COLUMN via TEXT NOT NULL DEFAULT 'manual'");
  // At most one account can ever carry the admin flag. The database itself refuses a second one, so
  // nothing (a stray command, a mistake, a bug) can create more admins.
  try {
    conn.exec("CREATE UNIQUE INDEX IF NOT EXISTS users_single_admin ON users(is_admin) WHERE is_admin = 1");
  } catch {
    console.error("[admin] More than one account has the admin flag, so the one-admin rule couldn't be applied. Remove the extras.");
  }
  for (const [column, type] of [
    ["kind", "TEXT NOT NULL DEFAULT 'site'"],
    ["url", "TEXT"],
    ["port", "INTEGER"],
    ["keyword", "TEXT"],
    ["keyword_mode", "TEXT"],
    ["hb_token", "TEXT"],
    ["hb_every_ms", "INTEGER"],
    ["hb_grace_ms", "INTEGER"],
    ["hb_last_ping", "INTEGER"],
    ["alert_targets", "TEXT"],
    ["down_alerted_at", "INTEGER"],
    ["ack_at", "INTEGER"],
    ["escalated_at", "INTEGER"],
    ["scan_result", "TEXT"],
    ["scan_checked_at", "INTEGER"],
    ["scan_due_at", "INTEGER NOT NULL DEFAULT 0"],
    ["dns_baseline", "TEXT"],
    ["links_alerted", "TEXT"],
    ["security_alerted", "TEXT"],
    ["client_id", "INTEGER REFERENCES clients(id) ON DELETE SET NULL"],
  ]) {
    if (!has("monitors", column)) conn.exec(`ALTER TABLE monitors ADD COLUMN ${column} ${type}`);
  }
  // Created here, not in SCHEMA, because on an older database the column only exists after the ALTER above.
  conn.exec("CREATE UNIQUE INDEX IF NOT EXISTS monitors_status_slug ON monitors(status_slug) WHERE status_slug IS NOT NULL");
  conn.exec("CREATE UNIQUE INDEX IF NOT EXISTS monitors_hb_token ON monitors(hb_token) WHERE hb_token IS NOT NULL");
  if (!has("uptime_hourly", "ms_sum")) conn.exec("ALTER TABLE uptime_hourly ADD COLUMN ms_sum INTEGER NOT NULL DEFAULT 0");
  if (!has("uptime_hourly", "ms_n")) conn.exec("ALTER TABLE uptime_hourly ADD COLUMN ms_n INTEGER NOT NULL DEFAULT 0");
  // The daily table started empty: fill it once from the hourly totals there already are.
  if (!(conn.prepare("SELECT 1 FROM uptime_daily LIMIT 1").get()) && conn.prepare("SELECT 1 FROM uptime_hourly LIMIT 1").get()) {
    conn.exec(`INSERT OR IGNORE INTO uptime_daily (monitor_id, day, total, ok, ms_sum, ms_n)
               SELECT monitor_id, (hour / 86400000) * 86400000, SUM(total), SUM(ok), SUM(ms_sum), SUM(ms_n) FROM uptime_hourly GROUP BY monitor_id, hour / 86400000`);
  }

  if (!has("reports", "client_id")) conn.exec("ALTER TABLE reports ADD COLUMN client_id INTEGER REFERENCES clients(id) ON DELETE SET NULL");

  // A custom domain used to belong to a monitor only. Rebuild the table so it can belong to a client instead.
  if (!has("custom_domains", "client_id")) {
    conn.exec("BEGIN");
    try {
      conn.exec(`CREATE TABLE custom_domains_new (
        id INTEGER PRIMARY KEY,
        user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        monitor_id INTEGER UNIQUE REFERENCES monitors(id) ON DELETE CASCADE,
        client_id INTEGER UNIQUE REFERENCES clients(id) ON DELETE CASCADE,
        domain TEXT NOT NULL,
        token TEXT NOT NULL,
        verified_at INTEGER,
        last_check_at INTEGER,
        fail_count INTEGER NOT NULL DEFAULT 0,
        created_at INTEGER NOT NULL
      )`);
      conn.exec(`INSERT INTO custom_domains_new (id, user_id, monitor_id, domain, token, verified_at, last_check_at, fail_count, created_at)
                 SELECT id, user_id, monitor_id, domain, token, verified_at, last_check_at, fail_count, created_at FROM custom_domains`);
      conn.exec("DROP TABLE custom_domains");
      conn.exec("ALTER TABLE custom_domains_new RENAME TO custom_domains");
      conn.exec("CREATE UNIQUE INDEX IF NOT EXISTS custom_domains_verified ON custom_domains(domain) WHERE verified_at IS NOT NULL");
      conn.exec("CREATE INDEX IF NOT EXISTS custom_domains_domain ON custom_domains(domain)");
      conn.exec("COMMIT");
    } catch (err) {
      conn.exec("ROLLBACK");
      throw err;
    }
  }

  // Older notifications were tied to their monitor and deleted with it. Rebuild the table so they keep
  // their own site name and outlive it. One transaction: it either fully happens or not at all.
  if (!columns().includes("host")) {
    conn.exec("BEGIN");
    try {
      conn.exec(eventsTable("monitor_events_new"));
      conn.exec(`INSERT INTO monitor_events_new (id, user_id, monitor_id, host, kind, message, details, emailed, created_at)
                 SELECT e.id, e.user_id, e.monitor_id, COALESCE(m.host, 'a removed site'), e.kind, e.message, e.details, e.emailed, e.created_at
                 FROM monitor_events e LEFT JOIN monitors m ON m.id = e.monitor_id`);
      conn.exec("DROP TABLE monitor_events");
      conn.exec("ALTER TABLE monitor_events_new RENAME TO monitor_events");
      conn.exec("CREATE INDEX IF NOT EXISTS monitor_events_user ON monitor_events(user_id, created_at)");
      conn.exec("COMMIT");
    } catch (err) {
      conn.exec("ROLLBACK");
      throw err;
    }
  }
}

// Dev mode reloads modules often; keep one connection on globalThis instead of one per reload.
const globalForDb = globalThis as unknown as { __siteMonitorDb?: DatabaseSync };

// Whether this copy of the code has brought the database up to date. It lives in the module, not on
// globalThis, so when dev mode reloads this file with new tables or columns, the kept connection is
// updated too, instead of only when the server first starts. Both steps are safe to repeat.
let upToDate = false;

export function db(): DatabaseSync {
  if (!globalForDb.__siteMonitorDb) {
    mkdirSync(path.dirname(DB_PATH), { recursive: true });
    const conn = new DatabaseSync(DB_PATH);
    conn.exec("PRAGMA journal_mode = WAL; PRAGMA foreign_keys = ON; PRAGMA busy_timeout = 5000;");
    globalForDb.__siteMonitorDb = conn;
  }
  if (!upToDate) {
    globalForDb.__siteMonitorDb.exec(SCHEMA);
    migrate(globalForDb.__siteMonitorDb);
    upToDate = true;
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

export function findSessionUser(tokenHash: string): { id: number; email: string; plan: string; isAdmin: boolean } | undefined {
  const row = db()
    .prepare(
      `SELECT u.id, u.email, u.plan, u.is_admin FROM sessions s JOIN users u ON u.id = s.user_id
       WHERE s.token_hash = ? AND s.expires_at > ?`,
    )
    .get(tokenHash, Date.now()) as { id: number; email: string; plan: string; is_admin: number } | undefined;
  return row && { id: row.id, email: row.email, plan: row.plan, isAdmin: row.is_admin === 1 };
}

/** Changes an account's plan. Callers must have decided the change is allowed. */
export function setUserPlan(userId: number, plan: string): void {
  db().prepare("UPDATE users SET plan = ? WHERE id = ?").run(plan, userId);
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
