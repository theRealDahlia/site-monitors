import { createHash, createHmac, randomBytes, randomInt, scrypt, timingSafeEqual } from "node:crypto";
import { BRAND } from "./brand";
import { adminEnabled } from "./admin";
import { SESSION_COOKIE } from "./cookie-names";
import { type PlanId, planId } from "./entitlements";
import {
  deleteSession,
  deleteSignupCode,
  findSessionUser,
  getSignupCode,
  insertSession,
  putSignupCode,
  recordCodeAttempt,
} from "./db";
import { sendMail } from "./mail";
import { secret } from "./secret";
import { workspaceFor } from "./teams";

export { safeNext } from "./safe-next";

const SESSION_DAYS = 30;

// scrypt cost: ~32 MB and tens of milliseconds per hash. Raise N as hardware allows.
const SCRYPT = { N: 1 << 15, r: 8, p: 1, keylen: 32, maxmem: 64 * 1024 * 1024 };

export const PASSWORD_MIN = 8;
export const PASSWORD_MAX = 128; // bounds hashing work per request

/**
 * Who a request is acting for. `id`, `email` and `plan` are the ACCOUNT's: a team member works in the owner's account,
 * so everything that reads or changes the account's data uses these. `actor` is the person actually signed in (the
 * same as the account unless they're a team member); use it for anything about them personally.
 */
export interface SessionUser {
  id: number;
  email: string;
  plan: PlanId;
  /** The development-only admin. Always false outside development mode. */
  isAdmin: boolean;
  actor: { id: number; email: string };
  /** "owner" in their own account, "member" in a team owner's. */
  role: "owner" | "member";
}

// ---------- input validation ----------

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export function normalizeEmail(input: unknown): string | null {
  if (typeof input !== "string") return null;
  const email = input.trim().toLowerCase();
  return email.length <= 254 && EMAIL_RE.test(email) ? email : null;
}

export function passwordProblem(password: unknown): string | null {
  if (typeof password !== "string") return "Enter a password.";
  if (password.length < PASSWORD_MIN) return `Use at least ${PASSWORD_MIN} characters.`;
  if (password.length > PASSWORD_MAX) return `Use at most ${PASSWORD_MAX} characters.`;
  return null;
}

/** Blocks cross-site form posts: a browser's Origin header must match the host being called. */
export function sameOrigin(request: Request): boolean {
  const origin = request.headers.get("origin");
  if (!origin) return true; // non-browser clients such as curl don't send one
  const host = request.headers.get("x-forwarded-host") ?? request.headers.get("host");
  try {
    return new URL(origin).host === host;
  } catch {
    return false;
  }
}

// ---------- passwords ----------

function derive(password: string, salt: Buffer): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    scrypt(password, salt, SCRYPT.keylen, SCRYPT, (err, key) => (err ? reject(err) : resolve(key)));
  });
}

export async function hashPassword(password: string): Promise<string> {
  const salt = randomBytes(16);
  const key = await derive(password, salt);
  return `scrypt$${SCRYPT.N}$${SCRYPT.r}$${SCRYPT.p}$${salt.toString("base64")}$${key.toString("base64")}`;
}

export async function verifyPassword(password: string, stored: string): Promise<boolean> {
  const [scheme, n, r, p, salt, hash] = stored.split("$");
  if (scheme !== "scrypt" || !salt || !hash) return false;
  const expected = Buffer.from(hash, "base64");
  const key = await new Promise<Buffer>((resolve, reject) => {
    scrypt(
      password,
      Buffer.from(salt, "base64"),
      expected.length,
      { N: Number(n), r: Number(r), p: Number(p), maxmem: SCRYPT.maxmem },
      (err, k) => (err ? reject(err) : resolve(k)),
    );
  });
  return key.length === expected.length && timingSafeEqual(key, expected);
}

const dummyHash = hashPassword("not-a-real-password");
/** Burns the same time as a real check, so an unknown email can't be told apart by response speed. */
export async function verifyAgainstDummy(password: string): Promise<void> {
  await verifyPassword(password, await dummyHash);
}

// ---------- sessions ----------

const sha256 = (value: string) => createHash("sha256").update(value).digest("hex");

function cookieValue(header: string | null, name: string): string | null {
  const found = header
    ?.split(";")
    .map((c) => c.trim())
    .find((c) => c.startsWith(`${name}=`));
  return found ? found.slice(name.length + 1) : null;
}

function cookieString(value: string, maxAgeSeconds: number): string {
  const parts = [`${SESSION_COOKIE}=${value}`, "Path=/", `Max-Age=${maxAgeSeconds}`, "HttpOnly", "SameSite=Lax"];
  if (process.env.NODE_ENV === "production") parts.push("Secure");
  return parts.join("; ");
}

/** Creates a session and returns the Set-Cookie header that logs the browser in. */
export function startSession(userId: number): string {
  const token = randomBytes(32).toString("base64url");
  // Only a hash is stored, so a leaked database can't be used to log in as anyone.
  insertSession(sha256(token), userId, Date.now() + SESSION_DAYS * 86_400_000);
  return cookieString(token, SESSION_DAYS * 86_400);
}

export function currentUser(request: Request): SessionUser | null {
  const token = cookieValue(request.headers.get("cookie"), SESSION_COOKIE);
  const user = token ? findSessionUser(sha256(token)) : undefined;
  if (!user) return null;
  // The admin flag only counts where admin is switched on (always in development, opt-in in production), and is the
  // signed-in person's own.
  const isAdmin = user.isAdmin && adminEnabled();
  const actor = { id: user.id, email: user.email };
  const team = workspaceFor(user.id);
  if (team) return { id: team.id, email: team.email, plan: planId(team.plan), isAdmin, actor, role: "member" };
  return { id: user.id, email: user.email, plan: planId(user.plan), isAdmin, actor, role: "owner" };
}

/** Ends the session and returns the Set-Cookie header that clears it. */
export function endSession(request: Request): string {
  const token = cookieValue(request.headers.get("cookie"), SESSION_COOKIE);
  if (token) deleteSession(sha256(token));
  return cookieString("", 0);
}

// ---------- sign-up confirmation codes ----------

const CODE_MINUTES = 10;
const MAX_CODE_ATTEMPTS = 5;
export const CODE_RESEND_SECONDS = 60;

// A 6-digit code has only a million possibilities, so a plain hash could be reversed instantly.
// Keying it with the server secret means a leaked database alone can't reveal pending codes.
const hashCode = (email: string, code: string) =>
  createHmac("sha256", secret()).update(`signup:${email}:${code}`).digest("hex");

export type CodeIssue = { ok: true } | { ok: false; retryAfterSeconds: number };

/**
 * Emails a new 6-digit code to `email`. Asking again within CODE_RESEND_SECONDS is refused,
 * which also stops us being used to flood someone's inbox. Throws if the email can't be sent.
 */
export async function issueSignupCode(email: string): Promise<CodeIssue> {
  const existing = getSignupCode(email);
  if (existing) {
    const wait = CODE_RESEND_SECONDS - Math.floor((Date.now() - existing.created_at) / 1000);
    if (wait > 0) return { ok: false, retryAfterSeconds: wait };
  }

  const code = String(randomInt(0, 1_000_000)).padStart(6, "0");
  putSignupCode(email, hashCode(email, code), Date.now() + CODE_MINUTES * 60_000);
  try {
    await sendMail({
      to: email,
      subject: `${code} is your ${BRAND} confirmation code`,
      text:
        `Your ${BRAND} confirmation code is:\n\n    ${code}\n\n` +
        `Enter it to finish creating your account. It expires in ${CODE_MINUTES} minutes.\n\n` +
        `If you didn't try to sign up, ignore this email. No account will be created.`,
    });
  } catch (err) {
    deleteSignupCode(email); // don't leave a code behind that nobody received
    throw err;
  }
  return { ok: true };
}

export type CodeCheck = { ok: true } | { ok: false; reason: "invalid" | "locked"; attemptsLeft: number };

/**
 * Checks a code the visitor typed. Every wrong guess counts, and after MAX_CODE_ATTEMPTS the
 * code is thrown away so it can't be brute-forced; they must ask for a new one.
 * A correct code is used up immediately and can't be reused.
 */
export function checkSignupCode(email: string, code: string): CodeCheck {
  const row = getSignupCode(email);
  if (!row || row.expires_at < Date.now() || row.attempts >= MAX_CODE_ATTEMPTS) {
    if (row) deleteSignupCode(email);
    return { ok: false, reason: row && row.attempts >= MAX_CODE_ATTEMPTS ? "locked" : "invalid", attemptsLeft: 0 };
  }

  const attempts = recordCodeAttempt(email);
  const expected = Buffer.from(row.code_hash);
  const given = Buffer.from(hashCode(email, code));
  if (expected.length === given.length && timingSafeEqual(expected, given)) {
    deleteSignupCode(email);
    return { ok: true };
  }

  if (attempts >= MAX_CODE_ATTEMPTS) {
    deleteSignupCode(email);
    return { ok: false, reason: "locked", attemptsLeft: 0 };
  }
  return { ok: false, reason: "invalid", attemptsLeft: MAX_CODE_ATTEMPTS - attempts };
}
